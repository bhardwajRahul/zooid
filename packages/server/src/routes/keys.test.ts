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

function adminRequest(path: string, options: RequestInit & { token: string }) {
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

describe('Key management API', () => {
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDb();
    adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  describe('GET /api/v1/keys', () => {
    it('returns empty key list initially', async () => {
      const res = await adminRequest('/api/v1/keys', {
        method: 'GET',
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { keys: unknown[] };
      expect(body.keys).toEqual([]);
    });

    it('returns keys after adding one', async () => {
      const { publicJwk } = await generateTestKeypair();
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('local-1', 'OKP', 'Ed25519', publicJwk.x!, 'local')
        .run();

      const res = await adminRequest('/api/v1/keys', {
        method: 'GET',
        token: adminToken,
      });
      const body = (await res.json()) as {
        keys: Array<{ kid: string; x: string }>;
      };
      expect(body.keys).toHaveLength(1);
      expect(body.keys[0].kid).toBe('local-1');
      expect(body.keys[0].x).toBe(publicJwk.x!);
    });

    it('rejects non-admin tokens', async () => {
      const publishToken = await createToken(
        { scope: 'publish', channel: 'test' },
        JWT_SECRET,
      );
      const res = await adminRequest('/api/v1/keys', {
        method: 'GET',
        token: publishToken,
      });
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await app.request(
        '/api/v1/keys',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/keys', () => {
    it('adds a trusted key', async () => {
      const { publicJwk } = await generateTestKeypair();
      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kid: 'partner-1',
          x: publicJwk.x!,
          max_scopes: ['pub:*', 'sub:*'],
          issuer: 'partner.dev',
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        kid: string;
        max_scopes: string[];
      };
      expect(body.kid).toBe('partner-1');
      expect(body.max_scopes).toEqual(['pub:*', 'sub:*']);
    });

    it('rejects duplicate kid', async () => {
      const { publicJwk } = await generateTestKeypair();
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('local-1', 'OKP', 'Ed25519', publicJwk.x!, 'local')
        .run();

      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid: 'local-1', x: publicJwk.x! }),
      });
      expect(res.status).toBe(409);
    });

    it('rejects missing kid', async () => {
      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 'some-key' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing x', async () => {
      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid: 'test-1' }),
      });
      expect(res.status).toBe(400);
    });

    it('adds a key with max_scopes', async () => {
      const { publicJwk } = await generateTestKeypair();
      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kid: 'partner-1',
          x: publicJwk.x!,
          max_scopes: ['pub:crypto-signals', 'pub:build-artifacts.*'],
          issuer: 'partner.dev',
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        kid: string;
        max_scopes: string[];
      };
      expect(body.kid).toBe('partner-1');
      expect(body.max_scopes).toEqual([
        'pub:crypto-signals',
        'pub:build-artifacts.*',
      ]);
    });

    it('returns max_scopes as null when not set', async () => {
      const { publicJwk } = await generateTestKeypair();
      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kid: 'partner-2',
          x: publicJwk.x!,
          issuer: 'partner.dev',
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        max_scopes: string[] | null;
      };
      expect(body.max_scopes).toBeNull();
    });

    it('returns max_scopes in GET /keys', async () => {
      const { publicJwk } = await generateTestKeypair();
      await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kid: 'partner-1',
          x: publicJwk.x!,
          max_scopes: ['sub:logs.*'],
          issuer: 'partner.dev',
        }),
      });

      const res = await adminRequest('/api/v1/keys', {
        method: 'GET',
        token: adminToken,
      });
      const body = (await res.json()) as {
        keys: Array<{ kid: string; max_scopes: string[] | null }>;
      };
      const key = body.keys.find((k) => k.kid === 'partner-1');
      expect(key!.max_scopes).toEqual(['sub:logs.*']);
    });

    it('enforces max 16 keys', async () => {
      // Insert 16 keys
      for (let i = 0; i < 16; i++) {
        const { publicJwk: pk } = await generateTestKeypair();
        await env.DB.prepare(
          'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
        )
          .bind(`key-${i}`, 'OKP', 'Ed25519', pk.x!, 'test')
          .run();
      }

      const { publicJwk } = await generateTestKeypair();
      const res = await adminRequest('/api/v1/keys', {
        method: 'POST',
        token: adminToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kid: 'key-overflow', x: publicJwk.x! }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('16');
    });
  });

  describe('DELETE /api/v1/keys/:kid', () => {
    it('removes a trusted key', async () => {
      const { publicJwk } = await generateTestKeypair();
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('partner-1', 'OKP', 'Ed25519', publicJwk.x!, 'partner.dev')
        .run();

      const res = await adminRequest('/api/v1/keys/partner-1', {
        method: 'DELETE',
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);

      // Verify it's gone
      const row = await env.DB.prepare(
        'SELECT * FROM trusted_keys WHERE kid = ?',
      )
        .bind('partner-1')
        .first();
      expect(row).toBeNull();
    });

    it('returns 404 for unknown kid', async () => {
      const res = await adminRequest('/api/v1/keys/nonexistent', {
        method: 'DELETE',
        token: adminToken,
      });
      expect(res.status).toBe(404);
    });

    it('blocks self-revocation (EdDSA token deleting its own key)', async () => {
      const { privateJwk, publicJwk } = await generateTestKeypair();

      // Add the key
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('local-1', 'OKP', 'Ed25519', publicJwk.x!, 'local')
        .run();

      // Create an admin EdDSA token signed by this key
      const eddsaAdmin = await createEdDSAToken(
        { scope: 'admin' },
        privateJwk,
        'local-1',
      );

      const res = await adminRequest('/api/v1/keys/local-1', {
        method: 'DELETE',
        token: eddsaAdmin,
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('Cannot revoke');
    });

    it('allows deleting OTHER keys with EdDSA token', async () => {
      const { privateJwk, publicJwk } = await generateTestKeypair();
      const { publicJwk: otherPublicJwk } = await generateTestKeypair();

      // Add two keys
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('local-2', 'OKP', 'Ed25519', publicJwk.x!, 'local')
        .run();
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('local-1', 'OKP', 'Ed25519', otherPublicJwk.x!, 'local')
        .run();

      // Token signed by local-2 deletes local-1 — allowed
      const eddsaAdmin = await createEdDSAToken(
        { scope: 'admin' },
        privateJwk,
        'local-2',
      );
      const res = await adminRequest('/api/v1/keys/local-1', {
        method: 'DELETE',
        token: eddsaAdmin,
      });
      expect(res.status).toBe(200);
    });

    it('allows HS256 admin to delete any key (no kid to match)', async () => {
      const { publicJwk } = await generateTestKeypair();
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('partner-1', 'OKP', 'Ed25519', publicJwk.x!, 'partner.dev')
        .run();

      const res = await adminRequest('/api/v1/keys/partner-1', {
        method: 'DELETE',
        token: adminToken,
      });
      expect(res.status).toBe(200);
    });
  });
});
