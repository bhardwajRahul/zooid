import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables, ZooidJWT } from '../types';

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
