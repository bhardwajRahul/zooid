import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import type { ServerStorage } from '../storage/server-types';

type Env = { Bindings: Bindings; Variables: Variables };

export class ListKeys extends OpenAPIRoute {
  schema = {
    summary: 'List trusted keys',
    tags: ['Keys'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'List of trusted keys',
        content: {
          'application/json': {
            schema: z.object({
              keys: z.array(
                z.object({
                  kid: z.string(),
                  kty: z.string(),
                  crv: z.string(),
                  x: z.string(),
                  max_scopes: z.array(z.string()).nullable(),
                  issuer: z.string().nullable(),
                  jwks_url: z.string().nullable(),
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
    const serverStorage = c.get('serverStorage') as ServerStorage;
    const rows = await serverStorage.listTrustedKeys();
    return c.json({
      keys: rows.map((r) => ({
        kid: r.kid,
        kty: r.kty,
        crv: r.crv,
        x: r.x,
        max_scopes: r.max_scopes ? JSON.parse(r.max_scopes) : null,
        issuer: r.issuer,
        jwks_url: r.jwks_url,
        created_at: r.created_at,
      })),
    });
  }
}

export class AddKey extends OpenAPIRoute {
  schema = {
    summary: 'Add a trusted key',
    tags: ['Keys'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z
              .object({
                kid: z.string().min(1),
                x: z.string().optional(),
                max_scopes: z.array(z.string()).optional(),
                issuer: z.string().optional(),
                jwks_url: z.string().url().optional(),
                kty: z.string().optional(),
                crv: z.string().optional(),
              })
              .refine((data) => data.x || data.jwks_url, {
                message:
                  'Either "x" (public key) or "jwks_url" must be provided',
              }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Key added',
        content: {
          'application/json': {
            schema: z.object({
              kid: z.string(),
              kty: z.string(),
              crv: z.string(),
              x: z.string(),
              max_scopes: z.array(z.string()).nullable(),
              issuer: z.string().nullable(),
              jwks_url: z.string().nullable(),
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
      409: {
        description: 'Key already exists',
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

    const serverStorage = c.get('serverStorage') as ServerStorage;
    const existing = await serverStorage.getTrustedKey(body.kid);
    if (existing) {
      return c.json({ error: `Key "${body.kid}" already exists` }, 409);
    }

    try {
      const key = await serverStorage.addTrustedKey(body);
      return c.json(
        {
          ...key,
          max_scopes: key.max_scopes ? JSON.parse(key.max_scopes) : null,
          jwks_url: key.jwks_url,
        },
        201,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add key';
      return c.json({ error: message }, 400);
    }
  }
}

export class RevokeKey extends OpenAPIRoute {
  schema = {
    summary: 'Revoke a trusted key',
    tags: ['Keys'],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        kid: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Key revoked',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
      403: {
        description: 'Cannot revoke own key',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Key not found',
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
    const targetKid = data.params.kid;
    const callerKid = c.get('jwtKid');

    // Self-revocation guard
    if (callerKid && targetKid === callerKid) {
      return c.json(
        { error: 'Cannot revoke the key that signed this request' },
        403,
      );
    }

    const serverStorage = c.get('serverStorage') as ServerStorage;
    const deleted = await serverStorage.removeTrustedKey(targetKid);
    if (!deleted) {
      return c.json({ error: 'Key not found' }, 404);
    }

    return c.json({ ok: true });
  }
}
