import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import { D1Dialect } from 'kysely-d1';
import type { Context } from 'hono';
import type { Bindings } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAuth: any = null;

export function getAuth(c: Context<{ Bindings: Bindings }>) {
  if (cachedAuth) return cachedAuth;

  const d1Dialect = new D1Dialect({ database: c.env.DB });

  cachedAuth = betterAuth({
    basePath: '/api/auth',
    baseURL: c.env.BETTER_AUTH_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    database: {
      dialect: d1Dialect,
      type: 'sqlite',
    },
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      jwt(),
      oauthProvider({
        loginPage: '/sign-in',
        consentPage: '/consent',
      }),
    ],
  });

  return cachedAuth;
}
