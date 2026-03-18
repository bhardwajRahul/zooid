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
import type { ChannelStorage } from '../storage/types';
import type { ServerStorage } from '../storage/server-types';

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
                  meta: z.record(z.string(), z.unknown()).nullable(),
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
    const serverStorage = c.get('serverStorage') as ServerStorage;
    const list = await serverStorage.listChannels();

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
              meta: z.record(z.string(), z.unknown()).optional(),
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

    if (body.config?.strict_types && !body.config?.types) {
      return c.json({ error: 'strict_types requires types in config' }, 400);
    }

    const serverStorage = c.get('serverStorage') as ServerStorage;
    const existing = await serverStorage.getChannel(body.id);
    if (existing) {
      return c.json({ error: 'Channel already exists' }, 409);
    }

    const channel = await serverStorage.createChannel(body);

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
              meta: z.record(z.string(), z.unknown()).nullable().optional(),
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
              meta: z.record(z.string(), z.unknown()).nullable(),
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

    const serverStorage = c.get('serverStorage') as ServerStorage;

    // Validate strict_types requires types — check incoming config or existing
    if (body.config?.strict_types && !body.config?.types) {
      const existing = await serverStorage.getChannel(channelId);
      const existingConfig = existing?.config
        ? JSON.parse(existing.config)
        : null;
      if (!existingConfig?.types) {
        return c.json({ error: 'strict_types requires types in config' }, 400);
      }
    }

    const channel = await serverStorage.updateChannel(channelId, body);
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
      meta: channel.meta ? JSON.parse(channel.meta as string) : null,
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

    // Destroy channel data (events + webhooks) via storage adapter
    const storage = c.get('channelStorage') as ChannelStorage | undefined;
    if (storage) {
      await storage.destroy();
    }

    // Delete channel registry entry via serverStorage
    const serverStorage = c.get('serverStorage') as ServerStorage;
    const deleted = await serverStorage.deleteChannel(channelId);
    if (!deleted) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    return c.body(null, 204);
  }
}

export class PatchChannelMeta extends OpenAPIRoute {
  schema = {
    summary: 'Patch channel meta (shallow merge)',
    tags: ['Channels'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        channelId: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.record(z.string(), z.unknown()),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated channel with merged meta',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              meta: z.record(z.string(), z.unknown()).nullable(),
            }),
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
    const patch = data.body;

    const serverStorage = c.get('serverStorage') as ServerStorage;
    const channel = await serverStorage.patchChannelMeta(channelId, patch);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    return c.json({
      id: channel.id,
      meta: channel.meta ? JSON.parse(channel.meta as string) : null,
    });
  }
}
