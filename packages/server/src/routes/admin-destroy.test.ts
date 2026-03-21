import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../index';
import { setupTestDb, cleanTestDb } from '../test-utils';
import { createToken } from '../lib/jwt';

const JWT_SECRET = 'test-jwt-secret';

async function authRequest(
  path: string,
  options: RequestInit = {},
  scope: 'admin' | 'publish' | 'subscribe' = 'admin',
) {
  const token = await createToken({ scope }, JWT_SECRET);
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return app.request(
    path,
    { ...options, headers },
    { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
  );
}

describe('POST /api/v1/admin/destroy', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  it('returns 401 without auth', async () => {
    const res = await app.request(
      '/api/v1/admin/destroy',
      { method: 'POST' },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 without admin scope', async () => {
    const res = await authRequest(
      '/api/v1/admin/destroy',
      { method: 'POST' },
      'publish',
    );
    expect(res.status).toBe(403);
  });

  it('destroys all channels and returns summary', async () => {
    // Create channels
    await env.DB.prepare(
      `INSERT INTO channels (id, name, is_public, created_at) VALUES (?, ?, 1, datetime('now'))`,
    )
      .bind('general', 'General')
      .run();
    await env.DB.prepare(
      `INSERT INTO channels (id, name, is_public, created_at) VALUES (?, ?, 1, datetime('now'))`,
    )
      .bind('alerts', 'Alerts')
      .run();

    const res = await authRequest('/api/v1/admin/destroy', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      destroyed: number;
      channels: string[];
    };
    expect(body.destroyed).toBe(2);
    expect(body.channels).toEqual(
      expect.arrayContaining(['general', 'alerts']),
    );

    // Verify channels are deleted from D1
    const { results } = await env.DB.prepare('SELECT id FROM channels').all();
    expect(results).toHaveLength(0);
  });

  it('returns success with 0 destroyed when no channels exist', async () => {
    const res = await authRequest('/api/v1/admin/destroy', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      destroyed: number;
      channels: string[];
    };
    expect(body.destroyed).toBe(0);
    expect(body.channels).toEqual([]);
  });

  it('cleans up server_meta and trusted_keys', async () => {
    // Insert server_meta
    await env.DB.prepare(
      `INSERT OR REPLACE INTO server_meta (id, name, description) VALUES (1, 'Test', 'A test server')`,
    ).run();
    // Insert trusted_key
    await env.DB.prepare(
      `INSERT INTO trusted_keys (kid, x) VALUES ('kid-1', 'pubkey-data')`,
    ).run();

    const res = await authRequest('/api/v1/admin/destroy', {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    const { results: meta } = await env.DB.prepare(
      'SELECT * FROM server_meta',
    ).all();
    expect(meta).toHaveLength(0);

    const { results: keys } = await env.DB.prepare(
      'SELECT * FROM trusted_keys',
    ).all();
    expect(keys).toHaveLength(0);
  });
});
