import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import { D1Dialect } from 'kysely-d1';
import type { User } from 'better-auth';
import type { Context } from 'hono';
import type { Bindings } from './index';

const ZOOID_ADMINS: Record<string, string[]> = {
  'admin@zooid.dev': ['admin'],
};

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
        customUserInfoClaims: ({ user }: { user: User }) => {
          const scopes = ZOOID_ADMINS[user.email];
          return scopes ? { 'https://zooid.dev/scopes': scopes } : {};
        },
        customIdTokenClaims: ({ user }: { user: User }) => {
          const scopes = ZOOID_ADMINS[user.email];
          return scopes ? { 'https://zooid.dev/scopes': scopes } : {};
        },
      }),
    ],
  });

  return cachedAuth;
}
