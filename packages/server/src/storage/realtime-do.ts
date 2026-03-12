import type { ZooidEvent } from '@zooid/types';
import type { RealtimeBroadcast } from './types';
import type { ChannelDO } from '../do/channel';

/**
 * RealtimeBroadcast backed by Durable Objects (V1 architecture).
 * Each broadcast call gets the DO stub by channel name and calls broadcast().
 */
export class DurableObjectRealtimeBroadcast implements RealtimeBroadcast {
  constructor(private doNamespace: DurableObjectNamespace<ChannelDO>) {}

  async broadcast(channelId: string, event: ZooidEvent): Promise<void> {
    const stub = this.doNamespace.get(this.doNamespace.idFromName(channelId));
    await stub.broadcast(event as unknown as Record<string, unknown>);
  }
}

/**
 * No-op broadcast for environments without Durable Objects (tests, Docker).
 */
export class NoOpRealtimeBroadcast implements RealtimeBroadcast {
  async broadcast(): Promise<void> {}
}
