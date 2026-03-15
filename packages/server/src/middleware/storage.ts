import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types';
import type { ChannelContext } from '../storage/types';
import type { ServerStorage } from '../storage/server-types';
import { getRetentionDays } from '../db/queries';

type Env = { Bindings: Bindings; Variables: Variables };

/**
 * Middleware that resolves a channel from D1 and sets up the storage adapter.
 * Use on routes that need ChannelStorage but don't go through requireSubscribeIfPrivate.
 * (e.g. publish, delete-event, delete-channel)
 */
export function resolveChannel(channelParam: string) {
  return createMiddleware<Env>(async (c, next) => {
    // Skip if already resolved (e.g. by requireSubscribeIfPrivate)
    if (c.get('channelStorage')) {
      await next();
      return;
    }

    const channelId = c.req.param(channelParam)!;
    const serverStorage = c.get('serverStorage') as ServerStorage;
    const channel = await serverStorage.getChannel(channelId);
    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    const ctx: ChannelContext = {
      channel_id: channelId,
      channel,
      is_public: channel.is_public === 1,
      retention_days: getRetentionDays(channel),
      signing_key: c.env.ZOOID_SIGNING_KEY,
      server_url: new URL(c.req.url).origin,
      server_id: c.env.ZOOID_SERVER_ID,
    };

    const backend = c.get('channelBackend');
    if (backend) {
      const { storage, realtime } = backend.getChannel(ctx);
      c.set('channelStorage', storage);
      c.set('realtimeBroadcast', realtime);
    }
    c.set('channelCtx', ctx);
    c.set('channelIsPublic', ctx.is_public);
    await next();
  });
}
