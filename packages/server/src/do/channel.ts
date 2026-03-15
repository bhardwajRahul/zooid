import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { CHANNEL_MIGRATIONS } from './migrations';
import { generateUlid } from '../lib/ulid';
import { importPrivateKey, signPayload } from '../lib/signing';

// ── Types ────────────────────────────────────────────────────────

export interface ChannelContext {
  channel_id: string;
  is_public: boolean;
  retention_days: number;
  signing_key?: string;
  server_url?: string;
  server_id?: string;
}

export interface PublishEventInput {
  publisher_id?: string | null;
  publisher_name?: string | null;
  type?: string | null;
  reply_to?: string | null;
  data: string; // JSON string, max 64KB
}

export interface PollOptions {
  cursor?: string;
  since?: string;
  limit?: number;
  type?: string;
  publisher_id?: string;
}

export interface PollResult {
  events: DOEvent[];
  cursor: string | null;
  has_more: boolean;
}

export interface DOEvent {
  id: string;
  publisher_id: string | null;
  publisher_name: string | null;
  type: string | null;
  reply_to: string | null;
  data: string;
  created_at: string;
}

export interface DOWebhook {
  id: string;
  url: string;
  event_types: string | null;
  expires_at: string;
  created_at: string;
}

export interface RegisterWebhookInput {
  url: string;
  event_types?: string[];
  ttl_seconds?: number;
}

// ── Constants ────────────────────────────────────────────────────

const MAX_DATA_BYTES = 65536; // 64KB
const MAX_BATCH_SIZE = 100;
const DEFAULT_POLL_LIMIT = 50;
const MAX_POLL_LIMIT = 100;
const DEFAULT_WEBHOOK_TTL = 3 * 86400; // 3 days
const MAX_WEBHOOK_TTL = 30 * 86400; // 30 days

const TAG_ALL = 'type:*';
const TAG_PREFIX = 'type:';

// ── ChannelDO ────────────────────────────────────────────────────

export class ChannelDO extends DurableObject<Bindings> {
  private sql: SqlStorage;
  private channelId: string | null = null;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.runMigrations();
    });
  }

  // ── Migrations ──────────────────────────────────────────────

  private runMigrations() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const rows = [
      ...this.sql.exec('SELECT MAX(version) as v FROM _migrations'),
    ];
    const currentVersion = (rows[0]?.v as number) ?? 0;

    for (const m of CHANNEL_MIGRATIONS) {
      if (m.version > currentVersion) {
        this.sql.exec(m.sql);
        this.sql.exec(
          'INSERT INTO _migrations (version) VALUES (?)',
          m.version,
        );
      }
    }
  }

  // ── Config Sync ─────────────────────────────────────────────

  private async syncConfig(ctx: ChannelContext): Promise<void> {
    this.channelId = ctx.channel_id;
    await this.ctx.storage.put('config', ctx);
  }

  // ── Events ──────────────────────────────────────────────────

  async publishEvent(
    ctx: ChannelContext,
    input: PublishEventInput,
  ): Promise<DOEvent> {
    await this.syncConfig(ctx);

    if (new TextEncoder().encode(input.data).length > MAX_DATA_BYTES) {
      throw new Error('Event payload exceeds 64KB limit');
    }

    // Validate reply_to
    if (input.reply_to) {
      const parent = [
        ...this.sql.exec('SELECT id FROM events WHERE id = ?', input.reply_to),
      ];
      if (parent.length === 0) {
        throw new Error(`reply_to event not found: ${input.reply_to}`);
      }
    }

    const id = generateUlid();

    this.sql.exec(
      `INSERT INTO events (id, publisher_id, publisher_name, type, reply_to, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      input.publisher_id ?? null,
      input.publisher_name ?? null,
      input.type ?? null,
      input.reply_to ?? null,
      input.data,
    );

    // Populate closure table for threading
    if (input.reply_to) {
      this.sql.exec('PRAGMA foreign_keys = ON');

      // Direct parent link
      this.sql.exec(
        `INSERT INTO thread_ancestors (event_id, ancestor_id, depth)
         VALUES (?, ?, 1)`,
        id,
        input.reply_to,
      );

      // Copy all of parent's ancestors with depth + 1
      this.sql.exec(
        `INSERT INTO thread_ancestors (event_id, ancestor_id, depth)
         SELECT ?, ancestor_id, depth + 1
         FROM thread_ancestors
         WHERE event_id = ?`,
        id,
        input.reply_to,
      );
    }

    const event = this.getEventById(id)!;

    // Broadcast to WebSocket clients
    this.broadcastToWebSockets(event);

    // Deliver to webhooks (fire-and-forget, DO stays alive for pending I/O)
    this.deliverToWebhooks(ctx, event);

    return event;
  }

  async publishEvents(
    ctx: ChannelContext,
    inputs: PublishEventInput[],
  ): Promise<DOEvent[]> {
    if (inputs.length > MAX_BATCH_SIZE) {
      throw new Error(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
    }

    const events: DOEvent[] = [];
    for (const input of inputs) {
      events.push(await this.publishEvent(ctx, input));
    }
    return events;
  }

  async pollEvents(
    ctx: ChannelContext,
    options: PollOptions,
  ): Promise<PollResult> {
    await this.syncConfig(ctx);

    // Lazy retention cleanup
    this.cleanupExpired(ctx.retention_days);

    const limit = Math.min(options.limit ?? DEFAULT_POLL_LIMIT, MAX_POLL_LIMIT);
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.cursor) {
      conditions.push('id > ?');
      params.push(options.cursor);
    }

    if (options.since) {
      conditions.push('created_at > ?');
      params.push(options.since);
    }

    if (options.type) {
      const types = options.type
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (types.length === 1) {
        conditions.push('type = ?');
        params.push(types[0]);
      } else if (types.length > 1) {
        conditions.push(`type IN (${types.map(() => '?').join(',')})`);
        params.push(...types);
      }
    }

    if (options.publisher_id) {
      conditions.push('publisher_id = ?');
      params.push(options.publisher_id);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // When no cursor/since anchor, fetch most recent (DESC) then reverse
    const hasAnchor = !!(options.cursor || options.since);
    const order = hasAnchor ? 'ASC' : 'DESC';

    params.push(limit + 1);

    const rows = [
      ...this.sql.exec(
        `SELECT * FROM events ${where} ORDER BY id ${order} LIMIT ?`,
        ...params,
      ),
    ] as unknown as DOEvent[];

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const events = hasAnchor ? trimmed : trimmed.reverse();
    const cursor = events.length > 0 ? events[events.length - 1].id : null;

    return {
      events: events.map((r) => this.formatEvent(r)),
      cursor: hasAnchor && hasMore ? cursor : null,
      has_more: hasAnchor ? hasMore : false,
    };
  }

  async getEvent(
    ctx: ChannelContext,
    eventId: string,
  ): Promise<DOEvent | null> {
    await this.syncConfig(ctx);
    return this.getEventById(eventId);
  }

  async deleteEvent(ctx: ChannelContext, eventId: string): Promise<boolean> {
    await this.syncConfig(ctx);
    this.sql.exec('PRAGMA foreign_keys = ON');
    const before = [
      ...this.sql.exec('SELECT id FROM events WHERE id = ?', eventId),
    ];
    if (before.length === 0) return false;
    this.sql.exec('DELETE FROM events WHERE id = ?', eventId);
    return true;
  }

  // ── Threads ─────────────────────────────────────────────────

  async getThread(ctx: ChannelContext, eventId: string): Promise<DOEvent[]> {
    await this.syncConfig(ctx);
    const rows = [
      ...this.sql.exec(
        `SELECT e.* FROM events e
         JOIN thread_ancestors ta ON e.id = ta.event_id
         WHERE ta.ancestor_id = ?
         ORDER BY e.created_at ASC`,
        eventId,
      ),
    ] as unknown as DOEvent[];
    return rows.map((r) => this.formatEvent(r));
  }

  async getReplies(ctx: ChannelContext, eventId: string): Promise<DOEvent[]> {
    await this.syncConfig(ctx);
    const rows = [
      ...this.sql.exec(
        `SELECT e.* FROM events e
         JOIN thread_ancestors ta ON e.id = ta.event_id
         WHERE ta.ancestor_id = ? AND ta.depth = 1
         ORDER BY e.created_at ASC`,
        eventId,
      ),
    ] as unknown as DOEvent[];
    return rows.map((r) => this.formatEvent(r));
  }

  // ── Webhooks ────────────────────────────────────────────────

  async registerWebhook(
    ctx: ChannelContext,
    input: RegisterWebhookInput,
  ): Promise<DOWebhook> {
    await this.syncConfig(ctx);

    const ttl = Math.min(
      input.ttl_seconds ?? DEFAULT_WEBHOOK_TTL,
      MAX_WEBHOOK_TTL,
    );
    const id = generateUlid();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const eventTypes = input.event_types
      ? JSON.stringify(input.event_types)
      : null;

    // Upsert on URL
    this.sql.exec(
      `INSERT INTO webhooks (id, url, event_types, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         event_types = excluded.event_types,
         expires_at = excluded.expires_at`,
      id,
      input.url,
      eventTypes,
      expiresAt,
    );

    // Read back the actual row (may have kept old id on upsert)
    const row = [
      ...this.sql.exec('SELECT * FROM webhooks WHERE url = ?', input.url),
    ][0] as unknown as DOWebhook;

    return {
      id: row.id,
      url: row.url,
      event_types: row.event_types,
      expires_at: row.expires_at,
      created_at: row.created_at,
    };
  }

  async deleteWebhook(
    ctx: ChannelContext,
    webhookId: string,
  ): Promise<boolean> {
    await this.syncConfig(ctx);
    const before = [
      ...this.sql.exec('SELECT id FROM webhooks WHERE id = ?', webhookId),
    ];
    if (before.length === 0) return false;
    this.sql.exec('DELETE FROM webhooks WHERE id = ?', webhookId);
    return true;
  }

  async getWebhooks(
    ctx: ChannelContext,
    eventType?: string,
  ): Promise<DOWebhook[]> {
    await this.syncConfig(ctx);

    if (eventType) {
      const rows = [
        ...this.sql.exec(
          `SELECT * FROM webhooks
           WHERE expires_at > datetime('now')
           AND (event_types IS NULL OR event_types LIKE ?)`,
          `%"${eventType}"%`,
        ),
      ] as unknown as DOWebhook[];
      return rows;
    }

    return [
      ...this.sql.exec(
        "SELECT * FROM webhooks WHERE expires_at > datetime('now')",
      ),
    ] as unknown as DOWebhook[];
  }

  // ── Lifecycle ───────────────────────────────────────────────

  async destroy(ctx: ChannelContext): Promise<void> {
    // Close all WebSocket connections
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, 'channel deleted');
      } catch {
        // Already closed
      }
    }
    // Wipe all storage (SQLite + KV metadata)
    await this.ctx.storage.deleteAll();
    // Re-run migrations so the DO is usable if accessed again
    this.runMigrations();
  }

  async getStats(
    ctx: ChannelContext,
  ): Promise<{ event_count: number; last_event_at: string | null }> {
    await this.syncConfig(ctx);
    const row = [
      ...this.sql.exec(
        'SELECT COUNT(*) as count, MAX(created_at) as last FROM events',
      ),
    ][0] as { count: number; last: string | null } | undefined;
    return {
      event_count: Number(row?.count ?? 0),
      last_event_at: row?.last ?? null,
    };
  }

  // ── WebSocket (Hibernatable) ────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const typesParam = url.searchParams.get('types');

    const tags: string[] = [];
    if (typesParam) {
      for (const t of typesParam.split(',')) {
        const trimmed = t.trim();
        if (trimmed) tags.push(TAG_PREFIX + trimmed);
      }
    }
    // No types specified → receive all events
    if (tags.length === 0) tags.push(TAG_ALL);

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], tags);

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /**
   * Public RPC for external broadcast. Used by backends that decouple
   * WebSocket management from storage (e.g. D1ChannelBackend + DO realtime).
   * The DO-backed storage adapter doesn't need this — it broadcasts on publish.
   */
  async broadcast(event: Record<string, unknown>): Promise<void> {
    this.broadcastToWebSockets(event as unknown as DOEvent);
  }

  webSocketMessage() {}
  webSocketClose() {}
  webSocketError() {}

  // ── Private Helpers ─────────────────────────────────────────

  private getEventById(eventId: string): DOEvent | null {
    const rows = [
      ...this.sql.exec('SELECT * FROM events WHERE id = ?', eventId),
    ];
    if (rows.length === 0) return null;
    return this.formatEvent(rows[0] as unknown as DOEvent);
  }

  private formatEvent(row: DOEvent): DOEvent {
    return {
      id: row.id,
      publisher_id: row.publisher_id ?? null,
      publisher_name: row.publisher_name ?? null,
      type: row.type ?? null,
      reply_to: row.reply_to ?? null,
      data: row.data,
      created_at: row.created_at,
    };
  }

  private cleanupExpired(retentionDays: number) {
    if (retentionDays <= 0) {
      // 0-day retention = delete everything
      this.sql.exec('PRAGMA foreign_keys = ON');
      this.sql.exec('DELETE FROM events');
      return;
    }
    this.sql.exec('PRAGMA foreign_keys = ON');
    this.sql.exec(
      `DELETE FROM events WHERE created_at < datetime('now', '-' || ? || ' days')`,
      retentionDays,
    );
  }

  private broadcastToWebSockets(event: DOEvent) {
    // Include channel_id in the broadcast for client consumption
    const payload = this.channelId
      ? { ...event, channel_id: this.channelId }
      : event;
    const message = JSON.stringify(payload);

    // Collect sockets that should receive this event
    const targets = new Set<WebSocket>();

    // Unfiltered sockets always receive
    for (const ws of this.ctx.getWebSockets(TAG_ALL)) {
      targets.add(ws);
    }

    // If the event has a type, also include sockets subscribed to that type
    if (event.type) {
      for (const ws of this.ctx.getWebSockets(TAG_PREFIX + event.type)) {
        targets.add(ws);
      }
    }

    for (const ws of targets) {
      try {
        ws.send(message);
      } catch {
        try {
          ws.close(1011, 'Broadcast failed');
        } catch {
          // Already closed
        }
      }
    }
  }

  private async deliverToWebhooks(
    ctx: ChannelContext,
    event: DOEvent,
  ): Promise<void> {
    // Get non-expired webhooks
    const webhooks = [
      ...this.sql.exec(
        "SELECT * FROM webhooks WHERE expires_at > datetime('now')",
      ),
    ] as unknown as DOWebhook[];

    if (webhooks.length === 0) return;

    const matchingWebhooks = webhooks.filter((wh) => {
      if (!wh.event_types) return true; // null = all events
      const types: string[] = JSON.parse(wh.event_types);
      return event.type != null && types.includes(event.type);
    });

    if (matchingWebhooks.length === 0) return;

    const timestamp = new Date().toISOString();
    const body = JSON.stringify(event);

    // Sign if signing key is available
    let signature: string | undefined;
    if (ctx.signing_key) {
      try {
        const privateKey = await importPrivateKey(ctx.signing_key);
        signature = await signPayload(privateKey, timestamp, body);
      } catch {
        // Signing failure shouldn't block delivery
      }
    }

    // Fire-and-forget parallel delivery — DO stays alive for pending I/O
    const deliveries = matchingWebhooks.map(async (wh) => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Zooid-Event-Id': event.id,
          'X-Zooid-Timestamp': timestamp,
          'X-Zooid-Channel': ctx.channel_id,
        };
        if (ctx.server_id) headers['X-Zooid-Server'] = ctx.server_id;
        if (ctx.server_url) headers['X-Zooid-Key-Id'] = 'server';
        if (signature) headers['X-Zooid-Signature'] = signature;

        await fetch(wh.url, {
          method: 'POST',
          headers,
          body,
        });
      } catch {
        // Fire-and-forget — log but don't throw
      }
    });

    // Don't await — let deliveries run in background. DO stays alive.
    Promise.allSettled(deliveries);
  }
}
