import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../index';
import { setupTestDb, cleanTestDb } from '../test-utils';
import { createToken, createEdDSAToken, verifyEdDSAToken } from '../lib/jwt';

const JWT_SECRET = 'test-jwt-secret';

describe('GET /api/v1/tokens/claims', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  it('returns scopes for an admin token', async () => {
    const token = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scopes).toEqual(['admin']);
    expect(body.iat).toBeTypeOf('number');
  });

  it('normalizes legacy publish token to scoped format', async () => {
    const token = await createToken(
      { scope: 'publish', channels: ['test-channel'], sub: 'pub_abc' },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scopes).toEqual(['pub:test-channel']);
    expect(body.sub).toBe('pub_abc');
  });

  it('normalizes legacy channel claim to scoped format', async () => {
    const token = await createToken(
      { scope: 'subscribe', channel: 'legacy-ch' },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scopes).toEqual(['sub:legacy-ch']);
  });

  it('normalizes legacy subscribe token with channels array', async () => {
    const token = await createToken(
      { scope: 'subscribe', channels: ['my-channel'] },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scopes).toEqual(['sub:my-channel']);
  });

  it('returns exp when token has expiry', async () => {
    const token = await createToken(
      { scope: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.exp).toBeTypeOf('number');
  });

  it('rejects without auth', async () => {
    const res = await app.request(
      '/api/v1/tokens/claims',
      {},
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: 'Bearer garbage.token.here' } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await createToken(
      { scope: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(401);
  });
});

// --- Helper for generating Ed25519 keypairs ---

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
  // Export as PKCS8 base64 (matches ZOOID_SIGNING_KEY format)
  const pkcs8 = await crypto.subtle.exportKey(
    'pkcs8',
    (keypair as CryptoKeyPair).privateKey,
  );
  const pkcs8Base64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  return { privateJwk, publicJwk, pkcs8Base64 };
}

describe('POST /api/v1/tokens', () => {
  beforeAll(() => setupTestDb());
  beforeEach(() => cleanTestDb());

  it('mints an HS256 token when no EdDSA key registered', async () => {
    const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/api/v1/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopes: ['pub:my-channel'],
        }),
      },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token).toBeTruthy();
    // Token should have HS256 header (no kid)
    const header = JSON.parse(atob(body.token.split('.')[0]));
    expect(header.alg).toBe('HS256');
  });

  it('mints an EdDSA token when signing key + trusted key exist', async () => {
    const key = await generateTestKeypair();
    const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);

    // Register the key in trusted_keys
    await app.request(
      '/api/v1/keys',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kid: 'local-1',
          x: key.publicJwk.x,
          issuer: 'local',
        }),
      },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    // Mint a token with ZOOID_SIGNING_KEY set
    const res = await app.request(
      '/api/v1/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopes: ['pub:my-channel'],
          sub: 'bot-1',
          name: 'My Bot',
        }),
      },
      {
        ...env,
        ZOOID_JWT_SECRET: JWT_SECRET,
        ZOOID_SIGNING_KEY: key.pkcs8Base64,
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };

    // Verify it's EdDSA with the right kid
    const header = JSON.parse(atob(body.token.split('.')[0]));
    expect(header.alg).toBe('EdDSA');
    expect(header.kid).toBe('local-1');

    // Verify token is valid
    const keyRow = {
      kid: 'local-1',
      kty: 'OKP',
      crv: 'Ed25519',
      x: key.publicJwk.x!,
      max_scopes: null,
      issuer: 'local',
      created_at: '',
    };
    const payload = await verifyEdDSAToken(body.token, keyRow);
    expect(payload.scopes).toEqual(['pub:my-channel']);
    expect(payload.sub).toBe('bot-1');
    expect(payload.name).toBe('My Bot');
  });

  it('supports expires_in', async () => {
    const key = await generateTestKeypair();
    const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);

    await app.request(
      '/api/v1/keys',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kid: 'local-1',
          x: key.publicJwk.x,
          issuer: 'local',
        }),
      },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    const res = await app.request(
      '/api/v1/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopes: ['sub:test'],
          expires_in: '1h',
        }),
      },
      {
        ...env,
        ZOOID_JWT_SECRET: JWT_SECRET,
        ZOOID_SIGNING_KEY: key.pkcs8Base64,
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };

    const keyRow = {
      kid: 'local-1',
      kty: 'OKP',
      crv: 'Ed25519',
      x: key.publicJwk.x!,
      max_scopes: null,
      issuer: 'local',
      created_at: '',
    };
    const payload = await verifyEdDSAToken(body.token, keyRow);
    expect(payload.exp).toBeDefined();
    // exp should be ~1 hour from now
    const diff = payload.exp! - payload.iat;
    expect(diff).toBe(3600);
  });

  it('rejects invalid expires_in', async () => {
    const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/api/v1/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scopes: ['admin'],
          expires_in: 'forever',
        }),
      },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid duration');
  });

  it('rejects non-admin callers', async () => {
    const publishToken = await createToken(
      { scope: 'publish', channels: ['ch'] },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publishToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scopes: ['sub:ch'] }),
      },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(403);
  });

  it('mints admin token with scopes array', async () => {
    const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/api/v1/tokens',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scopes: ['admin'] }),
      },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token).toBeTruthy();
  });
});
