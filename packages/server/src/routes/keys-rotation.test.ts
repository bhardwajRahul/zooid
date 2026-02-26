import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../index';
import { createToken, createEdDSAToken } from '../lib/jwt';
import { setupTestDb, cleanTestDb } from '../test-utils';

const JWT_SECRET = 'test-jwt-secret';

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

function request(path: string, options: RequestInit & { token: string }) {
  const { token, ...rest } = options;
  return app.request(
    path,
    {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(rest.headers ?? {}),
      },
    },
    { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
  );
}

describe('Key rotation integration test', () => {
  beforeAll(() => setupTestDb());
  beforeEach(() => cleanTestDb());

  it('full rotation: add new key → old tokens still work → mint new token → remove old key with new token', async () => {
    // --- Setup: HS256 admin + local-1 EdDSA key ---
    const hsAdmin = await createToken({ scope: 'admin' }, JWT_SECRET);
    const key1 = await generateTestKeypair();

    // Add local-1
    let res = await request('/api/v1/keys', {
      method: 'POST',
      token: hsAdmin,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kid: 'local-1',
        x: key1.publicJwk.x!,
        issuer: 'local',
      }),
    });
    expect(res.status).toBe(201);

    // Mint an EdDSA admin token with local-1
    const eddsaAdmin1 = await createEdDSAToken(
      { scope: 'admin' },
      key1.privateJwk,
      'local-1',
    );

    // Verify local-1 token works
    res = await request('/api/v1/keys', {
      method: 'GET',
      token: eddsaAdmin1,
    });
    expect(res.status).toBe(200);

    // --- Step 1: Generate new keypair, add local-2 ---
    const key2 = await generateTestKeypair();
    res = await request('/api/v1/keys', {
      method: 'POST',
      token: eddsaAdmin1,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kid: 'local-2',
        x: key2.publicJwk.x!,
        issuer: 'local',
      }),
    });
    expect(res.status).toBe(201);

    // --- Step 2: Old token (local-1) still works ---
    res = await request('/api/v1/keys', {
      method: 'GET',
      token: eddsaAdmin1,
    });
    expect(res.status).toBe(200);
    const keysBody = (await res.json()) as {
      keys: Array<{ kid: string }>;
    };
    expect(keysBody.keys).toHaveLength(2);
    expect(keysBody.keys.map((k) => k.kid).sort()).toEqual([
      'local-1',
      'local-2',
    ]);

    // --- Step 3: Mint new token with local-2 ---
    const eddsaAdmin2 = await createEdDSAToken(
      { scope: 'admin' },
      key2.privateJwk,
      'local-2',
    );

    // New token works
    res = await request('/api/v1/keys', {
      method: 'GET',
      token: eddsaAdmin2,
    });
    expect(res.status).toBe(200);

    // --- Step 4: Remove old key using new token ---
    res = await request('/api/v1/keys/local-1', {
      method: 'DELETE',
      token: eddsaAdmin2,
    });
    expect(res.status).toBe(200);

    // --- Step 5: Old token no longer works ---
    res = await request('/api/v1/keys', {
      method: 'GET',
      token: eddsaAdmin1,
    });
    expect(res.status).toBe(401);

    // --- Step 6: New token still works ---
    res = await request('/api/v1/keys', {
      method: 'GET',
      token: eddsaAdmin2,
    });
    expect(res.status).toBe(200);
    const finalKeys = (await res.json()) as {
      keys: Array<{ kid: string }>;
    };
    expect(finalKeys.keys).toHaveLength(1);
    expect(finalKeys.keys[0].kid).toBe('local-2');
  });

  it('HS256 tokens survive EdDSA key rotation (backward compat)', async () => {
    const hsAdmin = await createToken({ scope: 'admin' }, JWT_SECRET);
    const key1 = await generateTestKeypair();

    // Add and remove an EdDSA key
    await request('/api/v1/keys', {
      method: 'POST',
      token: hsAdmin,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kid: 'local-1',
        x: key1.publicJwk.x!,
        issuer: 'local',
      }),
    });
    await request('/api/v1/keys/local-1', {
      method: 'DELETE',
      token: hsAdmin,
    });

    // HS256 admin token still works — completely unaffected
    const res = await request('/api/v1/keys', {
      method: 'GET',
      token: hsAdmin,
    });
    expect(res.status).toBe(200);
  });

  it('external issuer lifecycle: add key → publish → scope ceiling → revoke → rejected', async () => {
    const hsAdmin = await createToken({ scope: 'admin' }, JWT_SECRET);
    const externalKey = await generateTestKeypair();

    // --- Add external issuer's key with publish ceiling ---
    let res = await request('/api/v1/keys', {
      method: 'POST',
      token: hsAdmin,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kid: 'partner-1',
        x: externalKey.publicJwk.x!,
        max_scope: 'publish',
        issuer: 'partner.dev',
      }),
    });
    expect(res.status).toBe(201);

    // --- External issuer mints a publish token with name ---
    const externalPublishToken = await createEdDSAToken(
      {
        scope: 'publish',
        channels: ['crypto-signals'],
        sub: 'price-bot',
        name: 'Price Tracker',
      },
      externalKey.privateJwk,
      'partner-1',
    );

    // Create a channel for testing
    await request('/api/v1/channels', {
      method: 'POST',
      token: hsAdmin,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'crypto-signals', name: 'Crypto Signals' }),
    });

    // External publish token works for publishing
    res = await request('/api/v1/channels/crypto-signals/events', {
      method: 'POST',
      token: externalPublishToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { signal: 'buy' } }),
    });
    expect(res.status).toBe(201);

    // Verify publisher_id is issuer:sub format
    const eventBody = (await res.json()) as { publisher_id: string };
    expect(eventBody.publisher_id).toBe('partner.dev:price-bot');

    // --- External issuer tries admin token — rejected by scope ceiling ---
    const externalAdminAttempt = await createEdDSAToken(
      { scope: 'admin' },
      externalKey.privateJwk,
      'partner-1',
    );
    res = await request('/api/v1/keys', {
      method: 'GET',
      token: externalAdminAttempt,
    });
    expect(res.status).toBe(401); // scope ceiling blocks it before reaching requireScope

    // --- Revoke external key ---
    res = await request('/api/v1/keys/partner-1', {
      method: 'DELETE',
      token: hsAdmin,
    });
    expect(res.status).toBe(200);

    // --- External token is now rejected ---
    res = await request('/api/v1/channels/crypto-signals/events', {
      method: 'POST',
      token: externalPublishToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { signal: 'sell' } }),
    });
    expect(res.status).toBe(401);
  });
});
