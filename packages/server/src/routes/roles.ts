import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';

type Env = { Bindings: Bindings; Variables: Variables };

export class ListRoles extends OpenAPIRoute {
  schema = {
    summary: 'List roles from scope mapping',
    tags: ['Roles'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'List of roles',
        content: {
          'application/json': {
            schema: z.object({
              roles: z.array(
                z.object({
                  id: z.string(),
                  scopes: z.array(z.string()),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<Env>) {
    const mapping = c.env.ZOOID_SCOPE_MAPPING;
    if (!mapping) {
      return c.json({ roles: [] });
    }

    try {
      const parsed = JSON.parse(mapping) as Record<string, string[]>;
      const roles = Object.entries(parsed).map(([id, scopes]) => ({
        id,
        scopes,
      }));
      return c.json({ roles });
    } catch {
      return c.json({ roles: [] });
    }
  }
}
