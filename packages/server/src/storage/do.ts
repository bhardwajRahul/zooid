import type { ZooidEvent, PollResult, Webhook } from '@zooid/types';
import type {
  ChannelStorage,
  ChannelContext,
  PublishEventInput,
  PollOptions,
  RegisterWebhookInput,
} from './types';
import type {
  ChannelDO,
  DOEvent,
  ChannelContext as DOChannelContext,
} from '../do/channel';

/**
 * Converts a DOEvent (no channel_id) to a ZooidEvent (with channel_id).
 */
function toZooidEvent(event: DOEvent, channelId: string): ZooidEvent {
  return {
    ...event,
    channel_id: channelId,
  };
}

/**
 * ChannelStorage backed by a ChannelDO via RPC.
 * Each method delegates to the DO stub, passing ChannelContext.
 */
export class DurableObjectChannelStorage implements ChannelStorage {
  private doCtx: DOChannelContext;

  constructor(
    private stub: DurableObjectStub<ChannelDO>,
    private ctx: ChannelContext,
  ) {
    this.doCtx = {
      channel_id: ctx.channel_id,
      is_public: ctx.is_public,
      retention_days: ctx.retention_days,
      signing_key: ctx.signing_key,
      server_url: ctx.server_url,
      server_id: ctx.server_id,
    };
  }

  async publishEvent(input: PublishEventInput): Promise<ZooidEvent> {
    const dataStr =
      typeof input.data === 'string' ? input.data : JSON.stringify(input.data);
    const event = await this.stub.publishEvent(this.doCtx, {
      publisher_id: input.publisher_id,
      publisher_name: input.publisher_name,
      type: input.type,
      reply_to: input.reply_to,
      data: dataStr,
    });
    return toZooidEvent(event, this.ctx.channel_id);
  }

  async publishEvents(inputs: PublishEventInput[]): Promise<ZooidEvent[]> {
    const doInputs = inputs.map((input) => ({
      publisher_id: input.publisher_id,
      publisher_name: input.publisher_name,
      type: input.type,
      reply_to: input.reply_to,
      data:
        typeof input.data === 'string'
          ? input.data
          : JSON.stringify(input.data),
    }));
    const events = await this.stub.publishEvents(this.doCtx, doInputs);
    return events.map((e) => toZooidEvent(e, this.ctx.channel_id));
  }

  async pollEvents(options: PollOptions): Promise<PollResult> {
    const result = await this.stub.pollEvents(this.doCtx, options);
    return {
      events: result.events.map((e) => toZooidEvent(e, this.ctx.channel_id)),
      cursor: result.cursor,
      has_more: result.has_more,
    };
  }

  async getEvent(eventId: string): Promise<ZooidEvent | null> {
    const event = await this.stub.getEvent(this.doCtx, eventId);
    return event ? toZooidEvent(event, this.ctx.channel_id) : null;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return this.stub.deleteEvent(this.doCtx, eventId);
  }

  async getThread(eventId: string): Promise<ZooidEvent[]> {
    const events = await this.stub.getThread(this.doCtx, eventId);
    return events.map((e) => toZooidEvent(e, this.ctx.channel_id));
  }

  async getReplies(eventId: string): Promise<ZooidEvent[]> {
    const events = await this.stub.getReplies(this.doCtx, eventId);
    return events.map((e) => toZooidEvent(e, this.ctx.channel_id));
  }

  async registerWebhook(input: RegisterWebhookInput): Promise<Webhook> {
    const wh = await this.stub.registerWebhook(this.doCtx, input);
    return {
      id: wh.id,
      channel_id: this.ctx.channel_id,
      url: wh.url,
      event_types: wh.event_types,
      expires_at: wh.expires_at,
      created_at: wh.created_at,
    };
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    return this.stub.deleteWebhook(this.doCtx, webhookId);
  }

  async getWebhooks(eventType?: string): Promise<Webhook[]> {
    const webhooks = await this.stub.getWebhooks(this.doCtx, eventType);
    return webhooks.map((wh) => ({
      id: wh.id,
      channel_id: this.ctx.channel_id,
      url: wh.url,
      event_types: wh.event_types,
      expires_at: wh.expires_at,
      created_at: wh.created_at,
    }));
  }

  async destroy(): Promise<void> {
    return this.stub.destroy(this.doCtx);
  }

  async getStats(): Promise<{
    event_count: number;
    last_event_at: string | null;
  }> {
    return this.stub.getStats(this.doCtx);
  }
}
