import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import type { ChannelStorage } from '../storage/types';

type Env = { Bindings: Bindings; Variables: Variables };

export class GetThread extends OpenAPIRoute {
  schema = {
    summary: 'Get full thread (all descendants of an event)',
    tags: ['Threads'],
    request: {
      params: z.object({
        channelId: z.string(),
        eventId: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Thread events',
        content: {
          'application/json': {
            schema: z.object({
              events: z.array(
                z.object({
                  id: z.string(),
                  channel_id: z.string(),
                  type: z.string().nullable(),
                  reply_to: z.string().nullable(),
                  data: z.string(),
                  publisher_id: z.string().nullable(),
                  publisher_name: z.string().nullable(),
                  created_at: z.string(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { eventId } = data.params;
    const storage = c.get('channelStorage') as ChannelStorage;

    const events = await storage.getThread(eventId);
    return c.json({ events });
  }
}

export class GetReplies extends OpenAPIRoute {
  schema = {
    summary: 'Get direct replies to an event (depth=1)',
    tags: ['Threads'],
    request: {
      params: z.object({
        channelId: z.string(),
        eventId: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Direct replies',
        content: {
          'application/json': {
            schema: z.object({
              events: z.array(
                z.object({
                  id: z.string(),
                  channel_id: z.string(),
                  type: z.string().nullable(),
                  reply_to: z.string().nullable(),
                  data: z.string(),
                  publisher_id: z.string().nullable(),
                  publisher_name: z.string().nullable(),
                  created_at: z.string(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { eventId } = data.params;
    const storage = c.get('channelStorage') as ChannelStorage;

    const events = await storage.getReplies(eventId);
    return c.json({ events });
  }
}
