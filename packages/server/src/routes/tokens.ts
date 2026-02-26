import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables, ZooidJWT } from '../types';
import { mintServerToken } from '../lib/jwt';
import { parseDuration } from '../lib/duration';

type Env = { Bindings: Bindings; Variables: Variables };

export class GetTokenClaims extends OpenAPIRoute {
  schema = {
    summary: 'Get claims of the current token',
    description:
      'Returns the decoded claims of the Bearer token. A 200 response means the token is valid.',
    tags: ['Tokens'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Token claims',
        content: {
          'application/json': {
            schema: z.object({
              scope: z.enum(['admin', 'publish', 'subscribe']),
              channels: z.array(z.string()).optional(),
              sub: z.string().optional(),
              iat: z.number(),
              exp: z.number().optional(),
            }),
          },
        },
      },
      401: {
        description: 'Missing or invalid token',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const payload = c.get('jwtPayload') as ZooidJWT;

    const claims: Record<string, unknown> = {
      scope: payload.scope,
      iat: payload.iat,
    };

    // Normalize legacy single-channel claim to channels array
    if (payload.channels) claims.channels = payload.channels;
    else if (payload.channel) claims.channels = [payload.channel];
    if (payload.sub) claims.sub = payload.sub;
    if (payload.exp) claims.exp = payload.exp;

    return c.json(claims);
  }
}

export class MintToken extends OpenAPIRoute {
  schema = {
    summary: 'Mint a new token',
    description:
      "Signs a new JWT with the server's signing key. Requires admin scope.",
    tags: ['Tokens'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              scope: z.enum(['admin', 'publish', 'subscribe']),
              channels: z.array(z.string()).optional(),
              sub: z.string().optional(),
              name: z.string().optional(),
              expires_in: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Minted token',
        content: {
          'application/json': {
            schema: z.object({
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
    },
  };

  async handle(c: Context<Env>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;

    if (
      body.scope !== 'admin' &&
      (!body.channels || body.channels.length === 0)
    ) {
      return c.json(
        { error: 'channels required for publish/subscribe tokens' },
        400,
      );
    }

    let expiresIn: number | undefined;
    if (body.expires_in) {
      try {
        expiresIn = parseDuration(body.expires_in);
      } catch (err) {
        return c.json(
          { error: err instanceof Error ? err.message : 'Invalid expires_in' },
          400,
        );
      }
    }

    const claims: Partial<ZooidJWT> = { scope: body.scope };
    if (body.channels) claims.channels = body.channels;
    if (body.sub) claims.sub = body.sub;
    if (body.name) claims.name = body.name;

    try {
      const token = await mintServerToken(claims, c.env, {
        expiresIn,
      });
      return c.json({ token });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Failed to mint token' },
        400,
      );
    }
  }
}
