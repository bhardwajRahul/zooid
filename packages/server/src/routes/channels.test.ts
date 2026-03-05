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
  channel?: string,
) {
  const token = await createToken({ scope, channel }, JWT_SECRET);
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return app.request(
    path,
    { ...options, headers },
    { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
  );
}

describe('Channel routes', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  describe('POST /channels', () => {
    it('creates a channel with admin token', async () => {
      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'test-channel',
          name: 'Test Channel',
          description: 'A test channel',
          is_public: true,
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        id: string;
        token: string;
      };
      expect(body.id).toBe('test-channel');
      expect(body.token).toBeTruthy();
    });

    it('rejects without auth', async () => {
      const res = await app.request(
        '/api/v1/channels',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'test-channel', name: 'Test Channel' }),
        },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );

      expect(res.status).toBe(401);
    });

    it('rejects with non-admin token', async () => {
      const res = await authRequest(
        '/api/v1/channels',
        {
          method: 'POST',
          body: JSON.stringify({ id: 'test-channel', name: 'Test Channel' }),
        },
        'publish',
        'some-channel',
      );

      expect(res.status).toBe(403);
    });

    it('rejects invalid channel ID (too short)', async () => {
      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'ab', name: 'Bad Channel' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects invalid channel ID (uppercase)', async () => {
      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'MyChannel', name: 'Bad Channel' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate channel ID', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'test-channel', name: 'Test Channel' }),
      });

      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'test-channel', name: 'Duplicate' }),
      });

      expect(res.status).toBe(409);
    });

    it('accepts optional config field', async () => {
      const config = {
        types: {
          trade: {
            schema: {
              type: 'object',
              properties: { market: { type: 'string' } },
              required: ['market'],
            },
          },
        },
      };

      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'config-channel',
          name: 'Config Channel',
          config,
        }),
      });

      expect(res.status).toBe(201);
    });

    it('creates a strict channel with config', async () => {
      const config = {
        types: {
          alert: {
            schema: {
              required: ['level'],
              properties: { level: { type: 'string' } },
            },
          },
        },
      };

      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'strict-channel',
          name: 'Strict Channel',
          config,
          strict: true,
        }),
      });

      expect(res.status).toBe(201);
    });

    it('rejects strict channel without config', async () => {
      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'strict-no-config',
          name: 'Bad Strict',
          strict: true,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('config');
    });

    it('creates a channel with tags', async () => {
      const res = await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'tagged-channel',
          name: 'Tagged Channel',
          tags: ['ai', 'crypto'],
        }),
      });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /channels', () => {
    it('returns empty list when no channels exist', async () => {
      const res = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { channels: unknown[] };
      expect(body.channels).toEqual([]);
    });

    it('lists all channels (no auth required)', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'channel-a', name: 'Channel A' }),
      });
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'channel-b', name: 'Channel B' }),
      });

      const res = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        channels: Array<{ id: string; name: string }>;
      };
      expect(body.channels).toHaveLength(2);
      expect(body.channels[0].id).toBeTruthy();
      expect(body.channels[0].name).toBeTruthy();
    });

    it('lists channels with tags', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'tagged-list',
          name: 'Tagged List',
          tags: ['ai', 'agents'],
        }),
      });

      const res = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as {
        channels: Array<{ id: string; tags: string[] }>;
      };

      const ch = body.channels.find((c) => c.id === 'tagged-list')!;
      expect(ch.tags).toEqual(['ai', 'agents']);
    });

    it('lists channels without tags as empty array', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'no-tags-list',
          name: 'No Tags',
        }),
      });

      const res = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as {
        channels: Array<{ id: string; tags: string[] }>;
      };

      const ch = body.channels.find((c) => c.id === 'no-tags-list')!;
      expect(ch.tags).toEqual([]);
    });

    it('includes event_count and last_event_at fields', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'count-channel', name: 'Count Channel' }),
      });

      const res = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as {
        channels: Array<{ event_count: number; last_event_at: string | null }>;
      };

      expect(body.channels[0]).toHaveProperty('event_count');
      expect(body.channels[0]).toHaveProperty('last_event_at');
    });

    it('hides private channels from unauthenticated requests', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'public-ch',
          name: 'Public',
          is_public: true,
        }),
      });
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'private-ch',
          name: 'Private',
          is_public: false,
        }),
      });

      const res = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as { channels: Array<{ id: string }> };
      expect(body.channels).toHaveLength(1);
      expect(body.channels[0].id).toBe('public-ch');
    });

    it('shows private channels to admin token', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'pub-ch', name: 'Public', is_public: true }),
      });
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'priv-ch',
          name: 'Private',
          is_public: false,
        }),
      });

      const res = await authRequest('/api/v1/channels', { method: 'GET' });
      const body = (await res.json()) as { channels: Array<{ id: string }> };
      expect(body.channels).toHaveLength(2);
    });

    it('shows private channels only when token has matching scope', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'visible-ch',
          name: 'Visible',
          is_public: false,
        }),
      });
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'hidden-ch',
          name: 'Hidden',
          is_public: false,
        }),
      });

      // Token with sub:visible-ch should only see visible-ch
      const token = await createToken(
        { scope: 'subscribe', channel: 'visible-ch' },
        JWT_SECRET,
      );
      const res = await app.request(
        '/api/v1/channels',
        { headers: { Authorization: `Bearer ${token}` } },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as { channels: Array<{ id: string }> };
      expect(body.channels).toHaveLength(1);
      expect(body.channels[0].id).toBe('visible-ch');
    });
  });

  describe('PATCH /channels/:channelId', () => {
    it('partially updates a channel preserving unspecified fields', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'update-me',
          name: 'Original Name',
          description: 'Original desc',
          tags: ['ai'],
          is_public: true,
        }),
      });

      const res = await authRequest('/api/v1/channels/update-me', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        id: string;
        name: string;
        description: string | null;
        tags: string[];
        is_public: boolean;
      };
      expect(body.name).toBe('New Name');
      expect(body.description).toBe('Original desc');
      expect(body.tags).toEqual(['ai']);
      expect(body.is_public).toBe(true);
    });

    it('toggles is_public', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'toggle-public',
          name: 'Toggle',
          is_public: true,
        }),
      });

      const res = await authRequest('/api/v1/channels/toggle-public', {
        method: 'PATCH',
        body: JSON.stringify({ is_public: false }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { is_public: boolean };
      expect(body.is_public).toBe(false);
    });

    it('sets and clears config', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'config-update', name: 'Config Update' }),
      });

      // Set config
      const config = {
        types: {
          metric: {
            schema: { type: 'object', properties: { v: { type: 'number' } } },
          },
        },
      };
      const res1 = await authRequest('/api/v1/channels/config-update', {
        method: 'PATCH',
        body: JSON.stringify({ config, strict: true }),
      });
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as {
        config: Record<string, unknown> | null;
        strict: boolean;
      };
      expect(body1.config).toEqual(config);
      expect(body1.strict).toBe(true);

      // Clear config
      const res2 = await authRequest('/api/v1/channels/config-update', {
        method: 'PATCH',
        body: JSON.stringify({ config: null, strict: false }),
      });
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as {
        config: Record<string, unknown> | null;
        strict: boolean;
      };
      expect(body2.config).toBeNull();
      expect(body2.strict).toBe(false);
    });

    it('clears description with null', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'clear-desc',
          name: 'Clear Desc',
          description: 'Will be cleared',
        }),
      });

      const res = await authRequest('/api/v1/channels/clear-desc', {
        method: 'PATCH',
        body: JSON.stringify({ description: null }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { description: string | null };
      expect(body.description).toBeNull();
    });

    it('returns 404 for non-existent channel', async () => {
      const res = await authRequest('/api/v1/channels/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Nope' }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Channel not found');
    });

    it('rejects without auth', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'no-auth-patch', name: 'No Auth' }),
      });

      const res = await app.request(
        '/api/v1/channels/no-auth-patch',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Hacked' }),
        },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );

      expect(res.status).toBe(401);
    });

    it('rejects with non-admin token', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'non-admin-patch', name: 'Non Admin' }),
      });

      const res = await authRequest(
        '/api/v1/channels/non-admin-patch',
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Hacked' }),
        },
        'subscribe',
        'non-admin-patch',
      );

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /channels/:channelId', () => {
    it('deletes an existing channel', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'delete-me', name: 'Delete Me' }),
      });

      const res = await authRequest('/api/v1/channels/delete-me', {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);

      // Verify channel is gone
      const listRes = await app.request(
        '/api/v1/channels',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await listRes.json()) as {
        channels: Array<{ id: string }>;
      };
      expect(body.channels.find((c) => c.id === 'delete-me')).toBeUndefined();
    });

    it('deletes associated events', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'cascade-test', name: 'Cascade Test' }),
      });

      // Publish an event
      await authRequest(
        '/api/v1/channels/cascade-test/events',
        {
          method: 'POST',
          body: JSON.stringify({ data: { test: true } }),
        },
        'publish',
        'cascade-test',
      );

      const res = await authRequest('/api/v1/channels/cascade-test', {
        method: 'DELETE',
      });
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent channel', async () => {
      const res = await authRequest('/api/v1/channels/nonexistent', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Channel not found');
    });

    it('rejects without auth', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'no-auth-del', name: 'No Auth' }),
      });

      const res = await app.request(
        '/api/v1/channels/no-auth-del',
        { method: 'DELETE' },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );

      expect(res.status).toBe(401);
    });

    it('rejects with non-admin token', async () => {
      await authRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({ id: 'non-admin-del', name: 'Non Admin' }),
      });

      const res = await authRequest(
        '/api/v1/channels/non-admin-del',
        { method: 'DELETE' },
        'subscribe',
        'non-admin-del',
      );

      expect(res.status).toBe(403);
    });
  });
});
