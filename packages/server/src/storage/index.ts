import type { ChannelDO } from '../do/channel';
import type { ChannelBackend, ChannelContext } from './types';
import { D1ChannelStorage } from './d1';
import {
  DurableObjectRealtimeBroadcast,
  NoOpRealtimeBroadcast,
} from './realtime-do';

export { D1ChannelStorage } from './d1';
export { DOChannelBackend } from './do-backend';
export {
  DurableObjectRealtimeBroadcast,
  NoOpRealtimeBroadcast,
} from './realtime-do';
export type {
  ChannelStorage,
  RealtimeBroadcast,
  ChannelBackend,
  ChannelContext,
  PublishEventInput,
  PollOptions,
  RegisterWebhookInput,
} from './types';

export { D1ServerStorage } from './d1-server';
export type {
  ServerStorage,
  CreateChannelInput,
  UpdateChannelInput,
  AddTrustedKeyInput,
} from './server-types';

/**
 * V1 backend: D1 for storage, Durable Objects for WebSocket broadcast.
 * Storage and realtime are independent — broadcast doesn't know about storage.
 */
export class D1ChannelBackend implements ChannelBackend {
  private realtime;

  constructor(
    private db: D1Database,
    doNamespace?: DurableObjectNamespace<ChannelDO>,
  ) {
    this.realtime = doNamespace
      ? new DurableObjectRealtimeBroadcast(doNamespace)
      : new NoOpRealtimeBroadcast();
  }

  getChannel(ctx: ChannelContext) {
    return {
      storage: new D1ChannelStorage(this.db, ctx),
      realtime: this.realtime,
    };
  }
}
