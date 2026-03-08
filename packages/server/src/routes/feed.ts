import { Hono } from 'hono';
import { stringify } from 'yaml';
import type { Bindings, Variables, ZooidEvent } from '../types';
import { getChannel } from '../db/queries';
import {
  pollEvents,
  cleanupExpiredEvents,
  getRetentionDays,
} from '../db/queries';
import { requireSubscribeIfPrivate } from '../middleware/auth';

type Env = { Bindings: Bindings; Variables: Variables };

export const feed = new Hono<Env>();

feed.get(
  '/channels/:channelId/feed.json',
  requireSubscribeIfPrivate('channelId'),
  async (c) => {
    const channelId = c.req.param('channelId');
    const db = c.env.DB;

    const channel = await getChannel(db, channelId);
    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    await cleanupExpiredEvents(db, channelId, getRetentionDays(channel));

    const result = await pollEvents(db, channelId, {
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
      title: channel.name,
      description: channel.description || '',
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
