import { Hono } from 'hono';
import { getAuth } from './auth';
import { oauthProviderOpenIdConfigMetadata } from '@better-auth/oauth-provider';

export type Bindings = {
  DB: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Mount Better Auth routes
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = getAuth(c);
  return auth.handler(c.req.raw);
});

// OIDC discovery (required for Zooid to find endpoints)
app.get('/.well-known/openid-configuration', (c) => {
  const auth = getAuth(c);
  return oauthProviderOpenIdConfigMetadata(auth)(c.req.raw);
});

// One-time setup: register the Zooid server as a trusted OAuth client.
// 1. Sign up at /sign-in
// 2. Visit /setup?redirect_uri=https://your-zooid-server.com/api/v1/auth/callback
// 3. Save the returned client_id and client_secret
// 4. Remove this route and redeploy
app.get('/setup', async (c) => {
  const redirectUri = c.req.query('redirect_uri');
  if (!redirectUri) {
    return c.json({ error: 'Missing ?redirect_uri= query parameter' }, 400);
  }

  const auth = getAuth(c);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await (auth.api as any).adminCreateOAuthClient({
      headers: c.req.raw.headers,
      body: {
        redirect_uris: [redirectUri],
        skip_consent: true,
        enable_end_session: true,
      },
    });
    return c.json(client);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Failed to create client' },
      500,
    );
  }
});

export default app;
