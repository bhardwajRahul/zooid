import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth, requireScope } from '../middleware/auth';

type Env = { Bindings: Bindings; Variables: Variables };

const adminDestroy = new Hono<Env>();

adminDestroy.use('*', requireAuth(), requireScope('admin'));

adminDestroy.post('/', async (c) => {
  const db = c.env.DB;
  const channelDO = c.env.CHANNEL_DO;

  // 1. List all channels
  const { results } = await db
    .prepare('SELECT id FROM channels')
    .all<{ id: string }>();

  const channelIds: string[] = [];

  // 2. Destroy each channel's Durable Object
  for (const ch of results || []) {
    const doId = channelDO.idFromName(ch.id);
    const stub = channelDO.get(doId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (stub as any).destroy({
        channel_id: ch.id,
        is_public: false,
        retention_days: 0,
      });
    } catch (err) {
      console.error(`Failed to destroy DO for channel ${ch.id}:`, err);
    }
    channelIds.push(ch.id);
  }

  // 3. Delete all channels from D1
  if (channelIds.length > 0) {
    await db.prepare('DELETE FROM channels').run();
  }

  // 4. Clean up server_meta and trusted_keys
  await db.prepare('DELETE FROM server_meta').run();
  await db.prepare('DELETE FROM trusted_keys').run();

  return c.json({
    destroyed: channelIds.length,
    channels: channelIds,
  });
});

export { adminDestroy };
