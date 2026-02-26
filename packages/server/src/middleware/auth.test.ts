import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { requireAuth, requireScope } from './auth';
import { createToken, createEdDSAToken } from '../lib/jwt';
import { setupTestDb, cleanTestDb } from '../test-utils';

const JWT_SECRET = 'test-jwt-secret';

// Generate a test Ed25519 keypair
async function generateTestKeypair() {
  const keypair = await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ]);
  const privateJwk = await crypto.subtle.exportKey(
    'jwk',
    (keypair as CryptoKeyPair).privateKey,
  );
  const publicJwk = await crypto.subtle.exportKey(
    'jwk',
    (keypair as CryptoKeyPair).publicKey,
  );
  return { privateJwk, publicJwk };
}

type TestBindings = {
  ZOOID_JWT_SECRET: string;
  DB: D1Database;
};
type TestVariables = {
  jwtPayload: { scope: string; channel?: string };
  jwtKid?: string;
};

function createTestApp() {
  const app = new Hono<{
    Bindings: TestBindings;
    Variables: TestVariables;
  }>();

  app.get('/public', (c) => c.json({ ok: true }));

  app.get('/protected', requireAuth(), (c) => {
    return c.json({
      scope: c.get('jwtPayload').scope,
      kid: c.get('jwtKid') ?? null,
    });
  });

  app.get('/admin', requireAuth(), requireScope('admin'), (c) => {
    return c.json({ admin: true });
  });

  app.post(
    '/publish/:channelId',
    requireAuth(),
    requireScope('publish', { channelParam: 'channelId' }),
    (c) => {
      return c.json({ published: true });
    },
  );

  return app;
}

describe('Auth middleware', () => {
  const app = createTestApp();
  const testEnv = { ZOOID_JWT_SECRET: JWT_SECRET, DB: env.DB };

  beforeAll(() => setupTestDb());

  it('allows unauthenticated access to public routes', async () => {
    const res = await app.request('/public', {}, testEnv);
    expect(res.status).toBe(200);
  });

  it('rejects requests without Authorization header', async () => {
    const res = await app.request('/protected', {}, testEnv);
    expect(res.status).toBe(401);
  });

  it('rejects requests with invalid token', async () => {
    const res = await app.request(
      '/protected',
      { headers: { Authorization: 'Bearer invalid-token' } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it('allows requests with valid token', async () => {
    const token = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scope: string };
    expect(body.scope).toBe('admin');
  });

  it('enforces admin scope', async () => {
    const token = await createToken(
      { scope: 'publish', channel: 'test' },
      JWT_SECRET,
    );
    const res = await app.request(
      '/admin',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(403);
  });

  it('allows admin scope on admin route', async () => {
    const token = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/admin',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('rejects publish token for wrong channel', async () => {
    const token = await createToken(
      { scope: 'publish', channel: 'channel-a' },
      JWT_SECRET,
    );
    const res = await app.request(
      '/publish/channel-b',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
    );
    expect(res.status).toBe(403);
  });

  it('allows admin token on any channel-scoped route', async () => {
    const token = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/publish/any-channel',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv,
    );
    expect(res.status).toBe(200);
  });
});

describe('Auth middleware — EdDSA backward compatibility', () => {
  const app = createTestApp();
  let privateJwk: JsonWebKey;
  let publicJwk: JsonWebKey;

  beforeAll(async () => {
    await setupTestDb();
    const keypair = await generateTestKeypair();
    privateJwk = keypair.privateJwk;
    publicJwk = keypair.publicJwk;
  });

  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM trusted_keys').run();
  });

  it('accepts EdDSA tokens when key exists in D1', async () => {
    await env.DB.prepare(
      'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
    )
      .bind('local-1', 'OKP', 'Ed25519', publicJwk.x!, 'local')
      .run();

    const token = await createEdDSAToken(
      { scope: 'admin' },
      privateJwk,
      'local-1',
    );
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      { ZOOID_JWT_SECRET: JWT_SECRET, DB: env.DB },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scope: string; kid: string };
    expect(body.scope).toBe('admin');
    expect(body.kid).toBe('local-1');
  });

  it('HS256 tokens still work alongside EdDSA (backward compat)', async () => {
    // Add an EdDSA key to D1 — HS256 should still work
    await env.DB.prepare(
      'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
    )
      .bind('local-1', 'OKP', 'Ed25519', publicJwk.x!, 'local')
      .run();

    const hsToken = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/admin',
      { headers: { Authorization: `Bearer ${hsToken}` } },
      { ZOOID_JWT_SECRET: JWT_SECRET, DB: env.DB },
    );
    expect(res.status).toBe(200);
  });

  it('rejects EdDSA tokens with unknown kid', async () => {
    const token = await createEdDSAToken(
      { scope: 'admin' },
      privateJwk,
      'nonexistent-kid',
    );
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      { ZOOID_JWT_SECRET: JWT_SECRET, DB: env.DB },
    );
    expect(res.status).toBe(401);
  });

  it('enforces scope ceiling on EdDSA tokens', async () => {
    await env.DB.prepare(
      'INSERT INTO trusted_keys (kid, kty, crv, x, max_scope, issuer) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        'external-1',
        'OKP',
        'Ed25519',
        publicJwk.x!,
        'publish',
        'partner.dev',
      )
      .run();

    // External admin token should be rejected (scope exceeds ceiling)
    const token = await createEdDSAToken(
      { scope: 'admin' },
      privateJwk,
      'external-1',
    );
    const res = await app.request(
      '/admin',
      { headers: { Authorization: `Bearer ${token}` } },
      { ZOOID_JWT_SECRET: JWT_SECRET, DB: env.DB },
    );
    expect(res.status).toBe(401);
  });

  it('allows EdDSA token within scope ceiling', async () => {
    await env.DB.prepare(
      'INSERT INTO trusted_keys (kid, kty, crv, x, max_scope, issuer) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(
        'external-1',
        'OKP',
        'Ed25519',
        publicJwk.x!,
        'publish',
        'partner.dev',
      )
      .run();

    const token = await createEdDSAToken(
      { scope: 'publish', channels: ['some-channel'] },
      privateJwk,
      'external-1',
    );
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      { ZOOID_JWT_SECRET: JWT_SECRET, DB: env.DB },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scope: string; kid: string };
    expect(body.scope).toBe('publish');
    expect(body.kid).toBe('external-1');
  });
});
