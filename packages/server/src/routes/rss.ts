import { Hono } from 'hono';
import { stringify } from 'yaml';
import type { Bindings, Variables, ZooidEvent } from '../types';
import type { ChannelStorage, ChannelContext } from '../storage/types';
import { requireSubscribeIfPrivate } from '../middleware/auth';
import { buildXml } from '../lib/xml';

type Env = { Bindings: Bindings; Variables: Variables };

export const rss = new Hono<Env>();

rss.get(
  '/channels/:channelId/rss',
  requireSubscribeIfPrivate('channelId'),
  async (c) => {
    const storage = c.get('channelStorage') as ChannelStorage;
    const ctx = c.get('channelCtx') as ChannelContext;

    const result = await storage.pollEvents({
      limit: 50,
      since: c.req.query('since'),
      cursor: c.req.query('cursor'),
      type: c.req.query('type'),
    });
    const format = c.req.query('format') || 'yaml';

    const items = [...result.events]
      .reverse()
      .map((event) => formatItem(event, format));

    const xml = buildXml({
      rss: {
        '@_version': '2.0',
        channel: {
          title: ctx.channel.name,
          description: ctx.channel.description || '',
          ...(items.length > 0 ? { item: items } : {}),
        },
      },
    });

    return c.body(xml, 200, {
      'Content-Type': 'application/rss+xml',
    });
  },
);

function formatItem(
  event: ZooidEvent,
  format: string,
): Record<string, unknown> {
  const type = event.type || 'event';
  const publisher = event.publisher_id || 'unknown';

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(event.data);
  } catch {
    data = {};
  }

  const description =
    format === 'json' ? JSON.stringify(data, null, 2) : stringify(data).trim();

  return {
    title: `[${type}] ${publisher}`,
    description: `<![CDATA[${description}]]>`,
    pubDate: new Date(event.created_at).toUTCString(),
    guid: event.id,
  };
}
