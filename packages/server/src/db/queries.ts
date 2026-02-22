import type {
  Channel,
  ChannelListItem,
  Publisher,
  ZooidEvent,
  Webhook,
  PollResult,
  ServerIdentity,
} from '../types';
import { generateUlid } from '../lib/ulid';

export async function createChannel(
  db: D1Database,
  channel: {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    is_public?: boolean;
    schema?: Record<string, unknown>;
    strict?: boolean;
  },
): Promise<Channel> {
  const isPublic = channel.is_public === false ? 0 : 1;
  const strict = channel.strict ? 1 : 0;
  const schema = channel.schema ? JSON.stringify(channel.schema) : null;
  const tags = channel.tags ? JSON.stringify(channel.tags) : null;

  await db
    .prepare(
      `INSERT INTO channels (id, name, description, tags, is_public, schema, strict) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      channel.id,
      channel.name,
      channel.description ?? null,
      tags,
      isPublic,
      schema,
      strict,
    )
    .run();

  const row = await db
    .prepare(`SELECT * FROM channels WHERE id = ?`)
    .bind(channel.id)
    .first<Channel>();

  return row!;
}

export async function updateChannel(
  db: D1Database,
  channelId: string,
  fields: {
    name?: string;
    description?: string | null;
    tags?: string[];
    is_public?: boolean;
    schema?: Record<string, unknown> | null;
    strict?: boolean;
  },
): Promise<Channel | null> {
  const existing = await db
    .prepare(`SELECT id FROM channels WHERE id = ?`)
    .bind(channelId)
    .first<{ id: string }>();

  if (!existing) return null;

  const setClauses: string[] = [];
  const binds: (string | number | null)[] = [];

  if (fields.name !== undefined) {
    setClauses.push('name = ?');
    binds.push(fields.name);
  }
  if (fields.description !== undefined) {
    setClauses.push('description = ?');
    binds.push(fields.description);
  }
  if (fields.tags !== undefined) {
    setClauses.push('tags = ?');
    binds.push(JSON.stringify(fields.tags));
  }
  if (fields.is_public !== undefined) {
    setClauses.push('is_public = ?');
    binds.push(fields.is_public ? 1 : 0);
  }
  if (fields.schema !== undefined) {
    setClauses.push('schema = ?');
    binds.push(fields.schema ? JSON.stringify(fields.schema) : null);
  }
  if (fields.strict !== undefined) {
    setClauses.push('strict = ?');
    binds.push(fields.strict ? 1 : 0);
  }

  if (setClauses.length > 0) {
    await db
      .prepare(`UPDATE channels SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...binds, channelId)
      .run();
  }

  const row = await db
    .prepare(`SELECT * FROM channels WHERE id = ?`)
    .bind(channelId)
    .first<Channel>();

  return row!;
}

export async function getChannel(
  db: D1Database,
  id: string,
): Promise<Channel | null> {
  return db
    .prepare(`SELECT * FROM channels WHERE id = ?`)
    .bind(id)
    .first<Channel>();
}

export async function listChannels(db: D1Database): Promise<ChannelListItem[]> {
  const rows = await db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.description,
        c.tags,
        c.is_public,
        c.schema,
        c.strict,
        COALESCE(e.event_count, 0) as event_count,
        e.last_event_at
      FROM channels c
      LEFT JOIN (
        SELECT
          channel_id,
          COUNT(*) as event_count,
          MAX(created_at) as last_event_at
        FROM events
        GROUP BY channel_id
      ) e ON c.id = e.channel_id
      ORDER BY c.created_at DESC`,
    )
    .all<{
      id: string;
      name: string;
      description: string | null;
      tags: string | null;
      is_public: number;
      schema: string | null;
      strict: number;
      event_count: number;
      last_event_at: string | null;
    }>();

  const channels: ChannelListItem[] = [];

  for (const row of rows.results) {
    const publishers = await db
      .prepare(`SELECT name FROM publishers WHERE channel_id = ?`)
      .bind(row.id)
      .all<{ name: string }>();

    channels.push({
      id: row.id,
      name: row.name,
      description: row.description,
      tags: row.tags ? JSON.parse(row.tags) : [],
      is_public: row.is_public === 1,
      schema: row.schema ? JSON.parse(row.schema) : null,
      strict: row.strict === 1,
      event_count: row.event_count,
      last_event_at: row.last_event_at,
      publishers: publishers.results.map((p) => p.name),
    });
  }

  return channels;
}

export async function createPublisher(
  db: D1Database,
  channelId: string,
  name: string,
): Promise<Publisher> {
  const id = generateUlid();

  await db
    .prepare(`INSERT INTO publishers (id, channel_id, name) VALUES (?, ?, ?)`)
    .bind(id, channelId, name)
    .run();

  const row = await db
    .prepare(`SELECT * FROM publishers WHERE id = ?`)
    .bind(id)
    .first<Publisher>();

  return row!;
}

// --- Event queries ---

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_BATCH_SIZE = 100;
const DEFAULT_POLL_LIMIT = 50;
const DEFAULT_WEBHOOK_TTL_SECONDS = 3 * 24 * 60 * 60; // 3 days
const MAX_WEBHOOK_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function createEvent(
  db: D1Database,
  event: {
    channelId: string;
    publisherId?: string | null;
    type?: string | null;
    data: unknown;
  },
): Promise<ZooidEvent> {
  const dataStr = JSON.stringify(event.data);
  if (new TextEncoder().encode(dataStr).length > MAX_PAYLOAD_BYTES) {
    throw new Error('Event payload exceeds 64KB limit');
  }

  const id = generateUlid();

  await db
    .prepare(
      `INSERT INTO events (id, channel_id, publisher_id, type, data) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      event.channelId,
      event.publisherId ?? null,
      event.type ?? null,
      dataStr,
    )
    .run();

  const row = await db
    .prepare(`SELECT * FROM events WHERE id = ?`)
    .bind(id)
    .first<ZooidEvent>();

  return row!;
}

export async function createEvents(
  db: D1Database,
  channelId: string,
  publisherId: string | null,
  events: Array<{ type?: string | null; data: unknown }>,
): Promise<ZooidEvent[]> {
  if (events.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
  }

  const ids: string[] = [];

  for (const event of events) {
    const dataStr = JSON.stringify(event.data);
    if (new TextEncoder().encode(dataStr).length > MAX_PAYLOAD_BYTES) {
      throw new Error('Event payload exceeds 64KB limit');
    }

    const id = generateUlid();
    ids.push(id);

    await db
      .prepare(
        `INSERT INTO events (id, channel_id, publisher_id, type, data) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, channelId, publisherId, event.type ?? null, dataStr)
      .run();
  }

  const results: ZooidEvent[] = [];
  for (const id of ids) {
    const row = await db
      .prepare(`SELECT * FROM events WHERE id = ?`)
      .bind(id)
      .first<ZooidEvent>();
    results.push(row!);
  }

  return results;
}

export async function pollEvents(
  db: D1Database,
  channelId: string,
  options: {
    since?: string;
    cursor?: string;
    limit?: number;
    type?: string;
  },
): Promise<PollResult> {
  const limit = options.limit ?? DEFAULT_POLL_LIMIT;
  const conditions: string[] = ['channel_id = ?'];
  const bindings: unknown[] = [channelId];

  if (options.since) {
    conditions.push('created_at > ?');
    bindings.push(options.since);
  }

  if (options.cursor) {
    conditions.push('id > ?');
    bindings.push(options.cursor);
  }

  if (options.type) {
    conditions.push('type = ?');
    bindings.push(options.type);
  }

  // When no cursor/since anchor, fetch the most recent events (DESC) and reverse
  // so the result is still in chronological order. With an anchor, fetch forward (ASC).
  const hasAnchor = !!(options.cursor || options.since);
  const order = hasAnchor ? 'ASC' : 'DESC';

  const sql = `SELECT * FROM events WHERE ${conditions.join(' AND ')} ORDER BY id ${order} LIMIT ?`;
  bindings.push(limit + 1);

  const stmt = db.prepare(sql);
  const result = await stmt.bind(...bindings).all<ZooidEvent>();
  const rows = result.results;

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;

  // DESC results need reversing to restore chronological order
  const events = hasAnchor ? trimmed : trimmed.reverse();
  const cursor = events.length > 0 ? events[events.length - 1].id : null;

  return {
    events,
    cursor: hasAnchor && hasMore ? cursor : null,
    has_more: hasAnchor ? hasMore : false,
  };
}

export async function cleanupExpiredEvents(
  db: D1Database,
  channelId: string,
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM events WHERE channel_id = ? AND created_at < datetime('now', '-7 days')`,
    )
    .bind(channelId)
    .run();

  return result.meta.changes ?? 0;
}

// --- Webhook queries ---

export async function createWebhook(
  db: D1Database,
  webhook: {
    channelId: string;
    url: string;
    eventTypes?: string[];
    ttlSeconds?: number;
  },
): Promise<Webhook> {
  const ttl = Math.min(
    webhook.ttlSeconds ?? DEFAULT_WEBHOOK_TTL_SECONDS,
    MAX_WEBHOOK_TTL_SECONDS,
  );
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const eventTypes = webhook.eventTypes
    ? JSON.stringify(webhook.eventTypes)
    : null;
  const id = generateUlid();

  await db
    .prepare(
      `INSERT INTO webhooks (id, channel_id, url, event_types, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(channel_id, url) DO UPDATE SET
         expires_at = excluded.expires_at,
         event_types = excluded.event_types`,
    )
    .bind(id, webhook.channelId, webhook.url, eventTypes, expiresAt)
    .run();

  // Fetch back — could be the new row or the updated existing one
  const row = await db
    .prepare(`SELECT * FROM webhooks WHERE channel_id = ? AND url = ?`)
    .bind(webhook.channelId, webhook.url)
    .first<Webhook>();

  return row!;
}

export async function deleteWebhook(
  db: D1Database,
  webhookId: string,
  channelId: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM webhooks WHERE id = ? AND channel_id = ?`)
    .bind(webhookId, channelId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function deleteChannel(
  db: D1Database,
  channelId: string,
): Promise<boolean> {
  const existing = await db
    .prepare('SELECT id FROM channels WHERE id = ?')
    .bind(channelId)
    .first<{ id: string }>();

  if (!existing) return false;

  await db.batch([
    db.prepare('DELETE FROM events WHERE channel_id = ?').bind(channelId),
    db.prepare('DELETE FROM webhooks WHERE channel_id = ?').bind(channelId),
    db.prepare('DELETE FROM publishers WHERE channel_id = ?').bind(channelId),
    db.prepare('DELETE FROM channels WHERE id = ?').bind(channelId),
  ]);

  return true;
}

export async function getWebhooksForChannel(
  db: D1Database,
  channelId: string,
  eventType?: string,
): Promise<Webhook[]> {
  if (eventType) {
    // Return webhooks that match the event type OR have no filter (null = all events)
    const result = await db
      .prepare(
        `SELECT * FROM webhooks
         WHERE channel_id = ? AND expires_at > datetime('now')
         AND (event_types IS NULL OR event_types LIKE ?)`,
      )
      .bind(channelId, `%"${eventType}"%`)
      .all<Webhook>();
    return result.results;
  }

  const result = await db
    .prepare(
      `SELECT * FROM webhooks WHERE channel_id = ? AND expires_at > datetime('now')`,
    )
    .bind(channelId)
    .all<Webhook>();
  return result.results;
}

// --- Server meta queries ---

interface ServerMetaRow {
  id: number;
  name: string;
  description: string | null;
  tags: string | null;
  owner: string | null;
  company: string | null;
  email: string | null;
  updated_at: string;
}

function rowToServerMeta(row: ServerMetaRow): ServerIdentity {
  return {
    name: row.name,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : [],
    owner: row.owner,
    company: row.company,
    email: row.email,
    updated_at: row.updated_at,
  };
}

export async function getServerMeta(
  db: D1Database,
): Promise<ServerIdentity | null> {
  const row = await db
    .prepare(`SELECT * FROM server_meta WHERE id = 1`)
    .first<ServerMetaRow>();

  return row ? rowToServerMeta(row) : null;
}

export async function upsertServerMeta(
  db: D1Database,
  meta: {
    name?: string;
    description?: string | null;
    tags?: string[];
    owner?: string | null;
    company?: string | null;
    email?: string | null;
  },
): Promise<ServerIdentity> {
  const tags = meta.tags !== undefined ? JSON.stringify(meta.tags) : undefined;

  // Build dynamic SET clause — only update fields that were provided.
  // This distinguishes undefined (not provided → keep existing) from null (clear it).
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const setBinds: (string | null)[] = [];

  if (meta.name !== undefined) {
    setClauses.push('name = ?');
    setBinds.push(meta.name);
  }
  if (meta.description !== undefined) {
    setClauses.push('description = ?');
    setBinds.push(meta.description);
  }
  if (tags !== undefined) {
    setClauses.push('tags = ?');
    setBinds.push(tags);
  }
  if (meta.owner !== undefined) {
    setClauses.push('owner = ?');
    setBinds.push(meta.owner);
  }
  if (meta.company !== undefined) {
    setClauses.push('company = ?');
    setBinds.push(meta.company);
  }
  if (meta.email !== undefined) {
    setClauses.push('email = ?');
    setBinds.push(meta.email);
  }

  await db
    .prepare(
      `INSERT INTO server_meta (id, name, description, tags, owner, company, email, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         ${setClauses.join(',\n         ')}`,
    )
    .bind(
      // INSERT values (use defaults for unspecified fields)
      meta.name ?? 'Zooid',
      meta.description ?? null,
      tags ?? null,
      meta.owner ?? null,
      meta.company ?? null,
      meta.email ?? null,
      // ON CONFLICT SET values (only the provided fields)
      ...setBinds,
    )
    .run();

  const row = await db
    .prepare(`SELECT * FROM server_meta WHERE id = 1`)
    .first<ServerMetaRow>();

  return rowToServerMeta(row!);
}
