import { Hono } from 'hono';
import { stringify } from 'yaml';
import type { Bindings, Variables, ZooidEvent } from '../types';
import type { ChannelStorage, ChannelContext } from '../storage/types';
import { requireSubscribeIfPrivate } from '../middleware/auth';

type Env = { Bindings: Bindings; Variables: Variables };

export const feed = new Hono<Env>();

feed.get(
  '/channels/:channelId/feed.json',
  requireSubscribeIfPrivate('channelId'),
  async (c) => {
    const storage = c.get('channelStorage') as ChannelStorage;
    const ctx = c.get('channelCtx') as ChannelContext;
    const channelId = ctx.channel_id;

    const result = await storage.pollEvents({
      limit: 50,
      since: c.req.query('since'),
      cursor: c.req.query('cursor'),
      type: c.req.query('type'),
    });
    const format = c.req.query('format') || 'yaml';

    const items = [...result.events]
      .reverse()
      .map((event) => formatItem(event, channelId, format));

    const jsonFeed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: ctx.channel.name,
      description: ctx.channel.description || '',
      items,
    };

    return c.json(jsonFeed, 200, {
      'Content-Type': 'application/feed+json',
    });
  },
);

function formatItem(
  event: ZooidEvent,
  channelId: string,
  format: string,
): Record<string, unknown> {
  const type = event.type || null;
  const publisher = event.publisher_id || 'unknown';

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(event.data);
  } catch {
    data = {};
  }

  const contentText =
    format === 'json' ? JSON.stringify(data, null, 2) : stringify(data).trim();

  const titleLabel = type || 'event';

  const item: Record<string, unknown> = {
    id: event.id,
    title: `[${titleLabel}] ${publisher}`,
    content_text: contentText,
    date_published: new Date(event.created_at).toISOString(),
    _zooid: {
      channel_id: channelId,
      publisher_id: event.publisher_id || null,
      type: type,
      data,
    },
  };

  if (type) {
    item.tags = [type];
  }

  return item;
}
