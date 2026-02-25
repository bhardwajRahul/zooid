import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../index';
import { setupTestDb } from '../test-utils';
import { createToken } from '../lib/jwt';

const JWT_SECRET = 'test-jwt-secret';

describe('GET /api/v1/tokens/claims', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  it('returns claims for an admin token', async () => {
    const token = await createToken({ scope: 'admin' }, JWT_SECRET);
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scope).toBe('admin');
    expect(body.iat).toBeTypeOf('number');
    expect(body).not.toHaveProperty('channel');
    expect(body).not.toHaveProperty('sub');
  });

  it('returns claims for a publish token with channels array', async () => {
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
    expect(body.scope).toBe('publish');
    expect(body.channels).toEqual(['test-channel']);
    expect(body.sub).toBe('pub_abc');
  });

  it('normalizes legacy channel claim to channels array', async () => {
    const token = await createToken(
      { scope: 'publish', channel: 'legacy-ch', sub: 'pub_abc' },
      JWT_SECRET,
    );
    const res = await app.request(
      '/api/v1/tokens/claims',
      { headers: { Authorization: `Bearer ${token}` } },
      { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scope).toBe('publish');
    expect(body.channels).toEqual(['legacy-ch']);
    expect(body).not.toHaveProperty('channel');
  });

  it('returns claims for a subscribe token', async () => {
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
    expect(body.scope).toBe('subscribe');
    expect(body.channels).toEqual(['my-channel']);
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
