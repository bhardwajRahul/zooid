import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables, ZooidJWT } from '../types';
import { isValidChannelId } from '../lib/validation';
import {
  mintServerToken,
  normalizeScopes,
  isAdmin,
  canPublish,
  canSubscribe,
} from '../lib/jwt';
import {
  createChannel,
  getChannel,
  listChannels,
  updateChannel,
  deleteChannel,
} from '../db/queries';

type Env = { Bindings: Bindings; Variables: Variables };

export class ListChannels extends OpenAPIRoute {
  schema = {
    summary: 'List channels',
    tags: ['Channels'],
    responses: {
      200: {
        description: 'List of channels',
        content: {
          'application/json': {
            schema: z.object({
              channels: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  description: z.string().nullable(),
                  tags: z.array(z.string()),
                  is_public: z.boolean(),
                  config: z.record(z.string(), z.unknown()).nullable(),
                  strict: z.boolean(),
                  event_count: z.number(),
                  last_event_at: z.string().nullable(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const list = await listChannels(c.env.DB);

    const payload = c.get('jwtPayload') as ZooidJWT | undefined;
    if (!payload) {
      // No auth — only public channels
      return c.json({ channels: list.filter((ch) => ch.is_public) });
    }

    const scopes = normalizeScopes(payload);
    if (isAdmin(scopes)) {
      return c.json({ channels: list });
    }

    // Filter to public channels + channels the token has access to
    return c.json({
      channels: list.filter(
        (ch) =>
          ch.is_public ||
          canPublish(scopes, ch.id) ||
          canSubscribe(scopes, ch.id),
      ),
    });
  }
}

export class CreateChannel extends OpenAPIRoute {
  schema = {
    summary: 'Create a channel',
    tags: ['Channels'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string().min(3).max(64),
              name: z.string().min(1),
              description: z.string().optional(),
              tags: z.array(z.string()).optional(),
              is_public: z.boolean().optional(),
              config: z.record(z.string(), z.unknown()).optional(),
              strict: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Channel created',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              token: z.string(),
            }),
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
      409: {
        description: 'Channel already exists',
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
    const body = data.body;

    if (!isValidChannelId(body.id)) {
      return c.json(
        {
          error:
            'Invalid channel ID. Must be 3-64 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens.',
        },
        400,
      );
    }

    if (body.strict && !body.config) {
      return c.json({ error: 'strict channels require a config' }, 400);
    }

    const existing = await getChannel(c.env.DB, body.id);
    if (existing) {
      return c.json({ error: 'Channel already exists' }, 409);
    }

    const channel = await createChannel(c.env.DB, body);

    const token = await mintServerToken(
      { scopes: [`pub:${channel.id}`, `sub:${channel.id}`] },
      c.env,
    );

    return c.json(
      {
        id: channel.id,
        token,
      },
      201,
    );
  }
}

export class UpdateChannel extends OpenAPIRoute {
  schema = {
    summary: 'Update a channel',
    tags: ['Channels'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        channelId: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).optional(),
              description: z.string().nullable().optional(),
              tags: z.array(z.string()).nullable().optional(),
              is_public: z.boolean().optional(),
              config: z.record(z.string(), z.unknown()).nullable().optional(),
              strict: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated channel',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              tags: z.array(z.string()),
              is_public: z.boolean(),
              config: z.record(z.string(), z.unknown()).nullable(),
              strict: z.boolean(),
            }),
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
    const body = data.body;

    if (body.strict && !body.config) {
      const existing = await getChannel(c.env.DB, channelId);
      if (existing && !existing.config) {
        return c.json({ error: 'strict channels require a config' }, 400);
      }
    }

    const channel = await updateChannel(c.env.DB, channelId, body);
    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    return c.json({
      id: channel.id,
      name: channel.name,
      description: channel.description ?? null,
      tags: channel.tags ? JSON.parse(channel.tags as string) : [],
      is_public: (channel.is_public as unknown as number) === 1,
      config: channel.config ? JSON.parse(channel.config as string) : null,
      strict: (channel.strict as unknown as number) === 1,
    });
  }
}

export class DeleteChannel extends OpenAPIRoute {
  schema = {
    summary: 'Delete a channel',
    tags: ['Channels'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        channelId: z.string(),
      }),
    },
    responses: {
      204: {
        description: 'Channel deleted',
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

    const deleted = await deleteChannel(c.env.DB, channelId);
    if (!deleted) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    return c.body(null, 204);
  }
}
