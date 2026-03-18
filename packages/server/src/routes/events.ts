import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import type {
  ChannelStorage,
  RealtimeBroadcast,
  ChannelContext,
} from '../storage/types';
import { isStrictTypes } from '../db/queries';
import { normalizeScopes, isAdmin } from '../lib/jwt';
import { importPrivateKey, signPayload } from '../lib/signing';
import { validateEvent } from '../lib/schema-validator';

type Env = { Bindings: Bindings; Variables: Variables };

export class PublishEvents extends OpenAPIRoute {
  schema = {
    summary: 'Publish event(s) to a channel',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        channelId: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              type: z.string().optional(),
              reply_to: z.string().optional(),
              data: z.unknown().optional(),
              meta: z.record(z.string(), z.unknown()).optional(),
              events: z
                .array(
                  z.object({
                    type: z.string().optional(),
                    reply_to: z.string().optional(),
                    data: z.unknown(),
                    meta: z.record(z.string(), z.unknown()).optional(),
                  }),
                )
                .optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Event(s) published',
        content: {
          'application/json': {
            schema: z.union([
              z.object({
                id: z.string(),
                channel_id: z.string(),
                type: z.string().nullable(),
                data: z.string(),
                publisher_id: z.string().nullable(),
                publisher_name: z.string().nullable(),
                created_at: z.string(),
              }),
              z.object({
                events: z.array(
                  z.object({
                    id: z.string(),
                    channel_id: z.string(),
                    type: z.string().nullable(),
                    data: z.string(),
                    publisher_id: z.string().nullable(),
                    created_at: z.string(),
                  }),
                ),
              }),
            ]),
          },
        },
      },
      400: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      401: {
        description: 'Missing or invalid authentication',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      403: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Channel not found',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { channelId } = data.params;
    const storage = c.get('channelStorage') as ChannelStorage;
    const realtime = c.get('realtimeBroadcast') as RealtimeBroadcast;
    const ctx = c.get('channelCtx') as ChannelContext;

    const body = data.body;
    const jwt = c.get('jwtPayload');
    const jwtIssuer = c.get('jwtIssuer');

    // Build publisher ID: issuer:sub for EdDSA tokens, plain sub for HS256
    const rawSub = jwt.sub ?? null;
    const publisherId = jwtIssuer && rawSub ? `${jwtIssuer}:${rawSub}` : rawSub;
    const publisherName = jwt.name ?? null;

    let strictSchema: Record<
      string,
      { required?: string[]; properties?: Record<string, unknown> }
    > | null = null;

    if (isStrictTypes(ctx.channel) && ctx.channel.config) {
      const parsed = JSON.parse(ctx.channel.config) as {
        types?: Record<string, { schema?: Record<string, unknown> }>;
      };
      if (parsed.types) {
        strictSchema = Object.fromEntries(
          Object.entries(parsed.types).map(([k, v]) => [
            k,
            v.schema ??
              ({ properties: v } as { properties?: Record<string, unknown> }),
          ]),
        );
      }
    }

    // Batch publish
    if ('events' in body && Array.isArray(body.events)) {
      for (const evt of body.events) {
        if (evt.data === undefined) {
          return c.json({ error: 'Each event must include a data field' }, 400);
        }
      }

      if (strictSchema) {
        for (const evt of body.events) {
          const result = validateEvent(strictSchema, evt.type, evt.data);
          if (!result.valid) {
            return c.json({ error: result.error }, 400);
          }
        }
      }

      const created = await storage.publishEvents(
        body.events.map((evt) => ({
          publisher_id: publisherId,
          publisher_name: publisherName,
          type: evt.type ?? null,
          reply_to: evt.reply_to ?? null,
          data: evt.data,
          meta: evt.meta,
        })),
      );

      const fanOut = async () => {
        for (const event of created) {
          try {
            await realtime.broadcast(channelId, event);
          } catch {
            // Broadcast may fail in test environments
          }
        }
        for (const event of created) {
          await deliverToWebhooks(storage, ctx, event);
        }
      };
      try {
        c.executionCtx.waitUntil(fanOut());
      } catch {
        await fanOut();
      }

      return c.json({ events: created }, 201);
    }

    // Single publish
    if (!('data' in body) || body.data === undefined) {
      return c.json({ error: 'Event must include a data field' }, 400);
    }

    if (strictSchema) {
      const result = validateEvent(strictSchema, body.type, body.data);
      if (!result.valid) {
        return c.json({ error: result.error }, 400);
      }
    }

    const event = await storage.publishEvent({
      publisher_id: publisherId,
      publisher_name: publisherName,
      type: body.type ?? null,
      reply_to: body.reply_to ?? null,
      data: body.data,
      meta: body.meta,
    });

    const afterPublish = async () => {
      try {
        await realtime.broadcast(channelId, event);
      } catch {
        // Broadcast may fail in test environments
      }
      await deliverToWebhooks(storage, ctx, event);
    };
    try {
      c.executionCtx.waitUntil(afterPublish());
    } catch {
      await afterPublish();
    }

    return c.json(event, 201);
  }
}

export class PollEvents extends OpenAPIRoute {
  schema = {
    summary: 'Poll events from a channel',
    tags: ['Events'],
    request: {
      params: z.object({
        channelId: z.string(),
      }),
      query: z.object({
        since: z.string().optional(),
        cursor: z.string().optional(),
        type: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
    },
    responses: {
      200: {
        description: 'Polled events',
        content: {
          'application/json': {
            schema: z.object({
              events: z.array(
                z.object({
                  id: z.string(),
                  channel_id: z.string(),
                  type: z.string().nullable(),
                  data: z.string(),
                  publisher_id: z.string().nullable(),
                  created_at: z.string(),
                }),
              ),
              cursor: z.string().nullable(),
              has_more: z.boolean(),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const storage = c.get('channelStorage') as ChannelStorage;

    const { since, cursor, type, limit } = data.query;

    const result = await storage.pollEvents({ since, cursor, type, limit });

    if (c.get('channelIsPublic')) {
      const maxAge = parseInt(c.env.ZOOID_POLL_INTERVAL ?? '2', 10);
      c.header('Cache-Control', `public, s-maxage=${maxAge}`);
    }

    return c.json(result);
  }
}

export class GetEventById extends OpenAPIRoute {
  schema = {
    summary: 'Get a single event by ID',
    tags: ['Events'],
    request: {
      params: z.object({
        channelId: z.string(),
        eventId: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Event found',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              channel_id: z.string(),
              type: z.string().nullable(),
              data: z.string(),
              publisher_id: z.string().nullable(),
              publisher_name: z.string().nullable(),
              created_at: z.string(),
            }),
          },
        },
      },
      404: {
        description: 'Event not found',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { eventId } = data.params;
    const storage = c.get('channelStorage') as ChannelStorage;

    const event = await storage.getEvent(eventId);
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json(event);
  }
}

export class DeleteEventById extends OpenAPIRoute {
  schema = {
    summary: 'Delete a single event by ID',
    tags: ['Events'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        channelId: z.string(),
        eventId: z.string(),
      }),
    },
    responses: {
      204: {
        description: 'Event deleted',
      },
      403: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Event not found',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { eventId } = data.params;
    const storage = c.get('channelStorage') as ChannelStorage;

    const event = await storage.getEvent(eventId);
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    // Must be admin or the original publisher
    const jwt = c.get('jwtPayload');
    const scopes = normalizeScopes(jwt);

    if (!isAdmin(scopes)) {
      const jwtIssuer = c.get('jwtIssuer');
      const rawSub = jwt.sub ?? null;
      const callerId = jwtIssuer && rawSub ? `${jwtIssuer}:${rawSub}` : rawSub;

      if (!callerId || callerId !== event.publisher_id) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
    }

    await storage.deleteEvent(eventId);
    return c.body(null, 204);
  }
}

export async function deliverToWebhooks(
  storage: ChannelStorage,
  ctx: ChannelContext,
  event: { id: string; type: string | null },
  fetchFn: typeof fetch = fetch,
) {
  const webhooks = await storage.getWebhooks(event.type ?? undefined);

  if (webhooks.length === 0) return;

  const signingKey = ctx.signing_key
    ? await importPrivateKey(ctx.signing_key)
    : null;

  const body = JSON.stringify(event as unknown as Record<string, unknown>);
  const timestamp = new Date().toISOString();

  const signature = signingKey
    ? await signPayload(signingKey, timestamp, body)
    : null;

  await Promise.allSettled(
    webhooks.map((webhook) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Zooid-Server': ctx.server_url,
        'X-Zooid-Timestamp': timestamp,
        'X-Zooid-Channel': ctx.channel_id,
        'X-Zooid-Event-Id': event.id,
        'X-Zooid-Key-Id': ctx.server_id || 'zooid-local',
      };

      if (signature) {
        headers['X-Zooid-Signature'] = signature;
      }

      return fetchFn(webhook.url, { method: 'POST', headers, body });
    }),
  );
}
