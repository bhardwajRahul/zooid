import type {
  ChannelBackend,
  ChannelContext,
  RealtimeBroadcast,
} from './types';
import { DurableObjectChannelStorage } from './do';
import type { ChannelDO } from '../do/channel';

/**
 * V2 backend: ChannelDO handles both storage AND realtime.
 * The DO broadcasts to WebSockets internally on publish,
 * so the RealtimeBroadcast returned here is a no-op.
 */
export class DOChannelBackend implements ChannelBackend {
  constructor(private doNamespace: DurableObjectNamespace<ChannelDO>) {}

  getChannel(ctx: ChannelContext) {
    const id = this.doNamespace.idFromName(ctx.channel_id);
    const stub = this.doNamespace.get(id);

    const storage = new DurableObjectChannelStorage(stub, ctx);

    // Realtime is handled inside the DO — broadcast happens on publishEvent.
    const realtime: RealtimeBroadcast = {
      async broadcast() {
        // No-op: DO handles broadcast internally
      },
    };

    return { storage, realtime };
  }
}
