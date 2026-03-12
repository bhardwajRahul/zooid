import type { ZooidEvent, PollResult, Webhook } from '@zooid/types';
import type {
  ChannelStorage,
  ChannelContext,
  PublishEventInput,
  PollOptions,
  RegisterWebhookInput,
} from './types';
import {
  createEvent,
  createEvents,
  pollEvents,
  getEvent,
  deleteEvent,
  cleanupExpiredEvents,
  createWebhook,
  deleteWebhook,
  getWebhooksForChannel,
} from '../db/queries';

/**
 * ChannelStorage backed by a shared D1 database (V1 architecture).
 * Thin wrapper around existing queries.ts functions.
 */
export class D1ChannelStorage implements ChannelStorage {
  constructor(
    private db: D1Database,
    private ctx: ChannelContext,
  ) {}

  async publishEvent(input: PublishEventInput): Promise<ZooidEvent> {
    return createEvent(this.db, {
      channelId: this.ctx.channel_id,
      publisherId: input.publisher_id,
      publisherName: input.publisher_name,
      type: input.type,
      data: input.data,
    });
  }

  async publishEvents(inputs: PublishEventInput[]): Promise<ZooidEvent[]> {
    return createEvents(
      this.db,
      this.ctx.channel_id,
      // Use the first event's publisher info for the batch
      // (batch publish uses a single publisher context)
      inputs[0]?.publisher_id ?? null,
      inputs[0]?.publisher_name ?? null,
      inputs.map((i) => ({ type: i.type, data: i.data })),
    );
  }

  async pollEvents(options: PollOptions): Promise<PollResult> {
    await cleanupExpiredEvents(
      this.db,
      this.ctx.channel_id,
      this.ctx.retention_days,
    );
    return pollEvents(this.db, this.ctx.channel_id, options);
  }

  async getEvent(eventId: string): Promise<ZooidEvent | null> {
    return getEvent(this.db, this.ctx.channel_id, eventId);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return deleteEvent(this.db, this.ctx.channel_id, eventId);
  }

  async registerWebhook(input: RegisterWebhookInput): Promise<Webhook> {
    return createWebhook(this.db, {
      channelId: this.ctx.channel_id,
      url: input.url,
      eventTypes: input.event_types,
      ttlSeconds: input.ttl_seconds,
    });
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    return deleteWebhook(this.db, webhookId, this.ctx.channel_id);
  }

  async getWebhooks(eventType?: string): Promise<Webhook[]> {
    return getWebhooksForChannel(this.db, this.ctx.channel_id, eventType);
  }

  async destroy(): Promise<void> {
    await this.db.batch([
      this.db
        .prepare('DELETE FROM webhooks WHERE channel_id = ?')
        .bind(this.ctx.channel_id),
      this.db
        .prepare('DELETE FROM events WHERE channel_id = ?')
        .bind(this.ctx.channel_id),
    ]);
  }

  async getStats(): Promise<{
    event_count: number;
    last_event_at: string | null;
  }> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) as event_count, MAX(created_at) as last_event_at
         FROM events WHERE channel_id = ?`,
      )
      .bind(this.ctx.channel_id)
      .first<{ event_count: number; last_event_at: string | null }>();

    return {
      event_count: row?.event_count ?? 0,
      last_event_at: row?.last_event_at ?? null,
    };
  }
}
