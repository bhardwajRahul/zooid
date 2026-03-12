import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import type { ChannelStorage } from '../storage/types';
import { isAllowedWebhookUrl } from '../lib/validation';

type Env = { Bindings: Bindings; Variables: Variables };

export class RegisterWebhook extends OpenAPIRoute {
  schema = {
    summary: 'Register a webhook',
    tags: ['Webhooks'],
    request: {
      params: z.object({
        channelId: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              url: z.string().url(),
              event_types: z.array(z.string()).optional(),
              ttl_seconds: z.number().int().positive().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Webhook registered',
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              channel_id: z.string(),
              url: z.string(),
              event_types: z.array(z.string()).nullable(),
              expires_at: z.string(),
              created_at: z.string(),
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
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const storage = c.get('channelStorage') as ChannelStorage;

    if (!isAllowedWebhookUrl(body.url)) {
      return c.json(
        { error: 'Webhook URL must be a public HTTP(S) endpoint' },
        400,
      );
    }

    const webhook = await storage.registerWebhook({
      url: body.url,
      event_types: body.event_types,
      ttl_seconds: body.ttl_seconds,
    });

    return c.json(webhook, 201);
  }
}

export class DeleteWebhook extends OpenAPIRoute {
  schema = {
    summary: 'Delete a webhook',
    tags: ['Webhooks'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        channelId: z.string(),
        webhookId: z.string(),
      }),
    },
    responses: {
      204: {
        description: 'Webhook deleted',
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
        description: 'Webhook not found',
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
    const { webhookId } = data.params;
    const storage = c.get('channelStorage') as ChannelStorage;

    const deleted = await storage.deleteWebhook(webhookId);
    if (!deleted) {
      return c.json({ error: 'Webhook not found' }, 404);
    }

    return c.body(null, 204);
  }
}
