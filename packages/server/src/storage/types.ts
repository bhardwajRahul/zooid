import type { ZooidEvent, PollResult, Webhook } from '@zooid/types';
import type { Channel } from '../types';

// ── Inputs ────────────────────────────────────────────────

/** Input for publishing a single event. */
export interface PublishEventInput {
  publisher_id?: string | null;
  publisher_name?: string | null;
  type?: string | null;
  reply_to?: string | null;
  data: unknown; // will be JSON.stringify'd, max 64KB
  meta?: unknown; // will be JSON.stringify'd if present
}

/** Options for polling events. */
export interface PollOptions {
  cursor?: string;
  since?: string;
  limit?: number; // default 50, max 100
  type?: string; // comma-separated event type filter
  publisher_id?: string; // filter by publisher sub/id
}

/** Input for registering a webhook. */
export interface RegisterWebhookInput {
  url: string;
  event_types?: string[];
  ttl_seconds?: number; // default 3 days, max 30 days
}

// ── Channel Context ───────────────────────────────────────

/**
 * Everything the storage/realtime adapters need to operate
 * for a single channel, without calling back to D1.
 */
export interface ChannelContext {
  channel_id: string;
  channel: Channel; // full D1 row, for config access
  is_public: boolean;
  retention_days: number;
  signing_key?: string;
  server_url: string;
  server_id?: string;
}

// ── Storage Adapter ───────────────────────────────────────

/**
 * Data-plane interface for a single channel.
 * Route handlers call this — they never touch D1/SQLite directly
 * for event or webhook operations.
 *
 * Each instance is scoped to one channel (channel_id is not a parameter).
 */
export interface ChannelStorage {
  // Events
  publishEvent(input: PublishEventInput): Promise<ZooidEvent>;
  publishEvents(inputs: PublishEventInput[]): Promise<ZooidEvent[]>;
  pollEvents(options: PollOptions): Promise<PollResult>;
  getEvent(eventId: string): Promise<ZooidEvent | null>;
  deleteEvent(eventId: string): Promise<boolean>;

  // Threads
  getThread(eventId: string): Promise<ZooidEvent[]>;
  getReplies(eventId: string): Promise<ZooidEvent[]>;

  // Webhooks
  registerWebhook(input: RegisterWebhookInput): Promise<Webhook>;
  deleteWebhook(webhookId: string): Promise<boolean>;
  getWebhooks(eventType?: string): Promise<Webhook[]>;

  // Lifecycle
  destroy(): Promise<void>;
  getStats(): Promise<{ event_count: number; last_event_at: string | null }>;
}

// ── Realtime Adapter ──────────────────────────────────────

/**
 * Pushes events to live connections for a channel.
 * Separated from storage because backends differ completely
 * (DO hibernatable WebSockets vs native ws vs SSE).
 */
export interface RealtimeBroadcast {
  broadcast(channelId: string, event: ZooidEvent): Promise<void>;
}

// ── Backend Factory ───────────────────────────────────────

/**
 * Creates a storage + realtime pair for a given channel.
 * The backend owns the relationship between them (e.g. a DO backend
 * may fuse both into a single actor to save on RPC billing).
 */
export interface ChannelBackend {
  getChannel(ctx: ChannelContext): {
    storage: ChannelStorage;
    realtime: RealtimeBroadcast;
  };
}
