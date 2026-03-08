import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../index';
import { setupTestDb, cleanTestDb } from '../test-utils';
import { createToken } from '../lib/jwt';
import { deliverToWebhooks } from './events';
import { createWebhook } from '../db/queries';

const JWT_SECRET = 'test-jwt-secret';

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await createToken({ scope: 'admin' }, JWT_SECRET);
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return app.request(
    path,
    { ...options, headers },
    {
      ...env,
      ZOOID_JWT_SECRET: JWT_SECRET,
    },
  );
}

async function publishRequest(
  path: string,
  options: RequestInit = {},
  channel: string,
) {
  const token = await createToken(
    { scope: 'publish', channel, sub: 'test-publisher' },
    JWT_SECRET,
  );
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return app.request(
    path,
    { ...options, headers },
    {
      ...env,
      ZOOID_JWT_SECRET: JWT_SECRET,
    },
  );
}

async function subscribeRequest(path: string, channel: string) {
  const token = await createToken(
    { scope: 'subscribe', channel, sub: 'test-subscriber' },
    JWT_SECRET,
  );
  return app.request(
    path,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
  );
}

describe('Event routes', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    await adminRequest('/api/v1/channels', {
      method: 'POST',
      body: JSON.stringify({
        id: 'pub-channel',
        name: 'Public Channel',
        is_public: true,
      }),
    });
    await adminRequest('/api/v1/channels', {
      method: 'POST',
      body: JSON.stringify({
        id: 'priv-channel',
        name: 'Private Channel',
        is_public: false,
      }),
    });
  });

  describe('POST /channels/:channelId/events (publish)', () => {
    it('publishes a single event', async () => {
      const res = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'signal',
            data: { message: 'hello' },
          }),
        },
        'pub-channel',
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        id: string;
        channel_id: string;
        type: string;
        publisher_id: string;
        created_at: string;
      };
      expect(body.id).toBeTruthy();
      expect(body.channel_id).toBe('pub-channel');
      expect(body.type).toBe('signal');
      expect(body.publisher_id).toBe('test-publisher');
      expect(body.created_at).toBeTruthy();
    });

    it('publishes a batch of events', async () => {
      const res = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({
            events: [
              { type: 'a', data: { v: 1 } },
              { type: 'b', data: { v: 2 } },
            ],
          }),
        },
        'pub-channel',
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        events: Array<{ id: string }>;
      };
      expect(body.events).toHaveLength(2);
      expect(body.events[0].id).toBeTruthy();
      expect(body.events[1].id).toBeTruthy();
    });

    it('rejects without publish token', async () => {
      const res = await app.request(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'x', data: {} }),
        },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(401);
    });

    it('rejects publish token for wrong channel', async () => {
      const res = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'x', data: {} }),
        },
        'other-channel',
      );
      expect(res.status).toBe(403);
    });

    it('rejects missing data field', async () => {
      const res = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'x' }),
        },
        'pub-channel',
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent channel', async () => {
      const res = await publishRequest(
        '/api/v1/channels/nonexistent/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'x', data: {} }),
        },
        'nonexistent',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Strict schema validation', () => {
    const strictConfig = {
      types: {
        alert: {
          schema: {
            required: ['level', 'message'],
            properties: {
              level: { type: 'string', enum: ['info', 'warn', 'error'] },
              message: { type: 'string' },
            },
          },
        },
        metric: {
          schema: {
            required: ['name', 'value'],
            properties: {
              name: { type: 'string' },
              value: { type: 'number' },
            },
          },
        },
      },
    };

    beforeEach(async () => {
      await adminRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'strict-channel',
          name: 'Strict Channel',
          config: { ...strictConfig, strict_types: true },
        }),
      });
      await adminRequest('/api/v1/channels', {
        method: 'POST',
        body: JSON.stringify({
          id: 'doconly-channel',
          name: 'Doc-Only Channel',
          config: strictConfig,
        }),
      });
    });

    it('strict channel accepts valid event', async () => {
      const res = await publishRequest(
        '/api/v1/channels/strict-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'alert',
            data: { level: 'info', message: 'hello' },
          }),
        },
        'strict-channel',
      );
      expect(res.status).toBe(201);
    });

    it('strict channel rejects event with no type', async () => {
      const res = await publishRequest(
        '/api/v1/channels/strict-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ data: { level: 'info', message: 'hello' } }),
        },
        'strict-channel',
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('must have a type');
    });

    it('strict channel rejects event with unknown type', async () => {
      const res = await publishRequest(
        '/api/v1/channels/strict-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'unknown', data: { foo: 'bar' } }),
        },
        'strict-channel',
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('Unknown event type');
    });

    it('strict channel rejects event with wrong data shape', async () => {
      const res = await publishRequest(
        '/api/v1/channels/strict-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'metric',
            data: { name: 'cpu', value: 'not-a-number' },
          }),
        },
        'strict-channel',
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('Validation failed');
    });

    it('strict channel validates batch events', async () => {
      const res = await publishRequest(
        '/api/v1/channels/strict-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({
            events: [
              { type: 'alert', data: { level: 'info', message: 'ok' } },
              { type: 'metric', data: { name: 'cpu', value: 'bad' } },
            ],
          }),
        },
        'strict-channel',
      );
      expect(res.status).toBe(400);
    });

    it('non-strict channel with schema does NOT validate', async () => {
      const res = await publishRequest(
        '/api/v1/channels/doconly-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'unknown-type',
            data: { anything: true },
          }),
        },
        'doconly-channel',
      );
      expect(res.status).toBe(201);
    });

    it('channel without schema is unaffected', async () => {
      const res = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ data: { anything: true } }),
        },
        'pub-channel',
      );
      expect(res.status).toBe(201);
    });
  });

  describe('GET /channels/:channelId/events (poll)', () => {
    it('polls events from a public channel without auth', async () => {
      await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'signal', data: { v: 1 } }),
        },
        'pub-channel',
      );

      const res = await app.request(
        '/api/v1/channels/pub-channel/events',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        events: Array<{ type: string }>;
        has_more: boolean;
      };
      expect(body.events).toHaveLength(1);
      expect(body.events[0].type).toBe('signal');
      expect(body.has_more).toBe(false);
    });

    it('requires subscribe token for private channel', async () => {
      const res = await app.request(
        '/api/v1/channels/priv-channel/events',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(401);
    });

    it('allows subscribe token for private channel', async () => {
      const res = await subscribeRequest(
        '/api/v1/channels/priv-channel/events',
        'priv-channel',
      );
      expect(res.status).toBe(200);
    });

    it('supports limit query param (returns most recent events)', async () => {
      for (let i = 0; i < 5; i++) {
        await publishRequest(
          '/api/v1/channels/pub-channel/events',
          {
            method: 'POST',
            body: JSON.stringify({ type: 'evt', data: { i } }),
          },
          'pub-channel',
        );
      }

      const res = await app.request(
        '/api/v1/channels/pub-channel/events?limit=2',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as {
        events: { data: string }[];
        has_more: boolean;
        cursor: string | null;
      };
      expect(body.events).toHaveLength(2);
      // Should return the 2 most recent events in chronological order
      expect(JSON.parse(body.events[0].data).i).toBe(3);
      expect(JSON.parse(body.events[1].data).i).toBe(4);
      expect(body.has_more).toBe(false);
    });

    it('supports cursor pagination (forward from anchor)', async () => {
      for (let i = 0; i < 3; i++) {
        await publishRequest(
          '/api/v1/channels/pub-channel/events',
          {
            method: 'POST',
            body: JSON.stringify({ type: 'evt', data: { i } }),
          },
          'pub-channel',
        );
      }

      // Use since to anchor pagination forward
      const page1 = await app.request(
        '/api/v1/channels/pub-channel/events?limit=2&since=2000-01-01T00:00:00Z',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body1 = (await page1.json()) as {
        cursor: string;
        events: unknown[];
        has_more: boolean;
      };
      expect(body1.events).toHaveLength(2);
      expect(body1.has_more).toBe(true);
      expect(body1.cursor).toBeTruthy();

      const page2 = await app.request(
        `/api/v1/channels/pub-channel/events?limit=2&cursor=${body1.cursor}`,
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body2 = (await page2.json()) as {
        events: unknown[];
        has_more: boolean;
      };
      expect(body2.events).toHaveLength(1);
      expect(body2.has_more).toBe(false);
    });

    it('supports type filter', async () => {
      await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'signal', data: {} }),
        },
        'pub-channel',
      );
      await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'alert', data: {} }),
        },
        'pub-channel',
      );

      const res = await app.request(
        '/api/v1/channels/pub-channel/events?type=signal',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      const body = (await res.json()) as {
        events: Array<{ type: string }>;
      };
      expect(body.events).toHaveLength(1);
      expect(body.events[0].type).toBe('signal');
    });

    it('returns 404 for non-existent channel', async () => {
      const res = await app.request(
        '/api/v1/channels/nonexistent/events',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /channels/:channelId/events/:eventId', () => {
    it('gets an event by ID from a public channel without auth', async () => {
      const pubRes = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'signal', data: { msg: 'hi' } }),
        },
        'pub-channel',
      );
      const event = (await pubRes.json()) as { id: string };

      const res = await app.request(
        `/api/v1/channels/pub-channel/events/${event.id}`,
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        id: string;
        channel_id: string;
        type: string;
        data: string;
        publisher_id: string;
      };
      expect(body.id).toBe(event.id);
      expect(body.channel_id).toBe('pub-channel');
      expect(body.type).toBe('signal');
      expect(JSON.parse(body.data)).toEqual({ msg: 'hi' });
    });

    it('returns 404 for non-existent event', async () => {
      const res = await app.request(
        '/api/v1/channels/pub-channel/events/01NONEXISTENT00000000000000',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 for event in wrong channel', async () => {
      const pubRes = await publishRequest(
        '/api/v1/channels/pub-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'signal', data: {} }),
        },
        'pub-channel',
      );
      const event = (await pubRes.json()) as { id: string };

      // Try to get it via a different channel
      const res = await subscribeRequest(
        `/api/v1/channels/priv-channel/events/${event.id}`,
        'priv-channel',
      );
      expect(res.status).toBe(404);
    });

    it('requires subscribe token for private channel', async () => {
      const res = await app.request(
        '/api/v1/channels/priv-channel/events/01FAKE00000000000000000000',
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(401);
    });

    it('allows subscribe token for private channel', async () => {
      // Publish as admin to the private channel
      const pubRes = await adminRequest(
        '/api/v1/channels/priv-channel/events',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'signal', data: { secret: true } }),
        },
      );
      const event = (await pubRes.json()) as { id: string };

      const res = await subscribeRequest(
        `/api/v1/channels/priv-channel/events/${event.id}`,
        'priv-channel',
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string };
      expect(body.id).toBe(event.id);
    });
  });

  describe('DELETE /channels/:channelId/events/:eventId', () => {
    async function publishAs(channel: string, sub: string) {
      const token = await createToken(
        { scope: 'publish', channel, sub },
        JWT_SECRET,
      );
      const res = await app.request(
        `/api/v1/channels/${channel}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'signal', data: { from: sub } }),
        },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      return (await res.json()) as { id: string; publisher_id: string };
    }

    async function deleteAs(
      channel: string,
      eventId: string,
      tokenClaims: Record<string, unknown>,
    ) {
      const token = await createToken(
        tokenClaims as Partial<Parameters<typeof createToken>[0]>,
        JWT_SECRET,
      );
      return app.request(
        `/api/v1/channels/${channel}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
    }

    it('admin can delete any event', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      const res = await deleteAs('pub-channel', event.id, { scope: 'admin' });
      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await app.request(
        `/api/v1/channels/pub-channel/events/${event.id}`,
        {},
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(getRes.status).toBe(404);
    });

    it('publisher can delete their own event', async () => {
      const event = await publishAs('pub-channel', 'agent-a');
      expect(event.publisher_id).toBe('agent-a');

      const res = await deleteAs('pub-channel', event.id, {
        scope: 'publish',
        channel: 'pub-channel',
        sub: 'agent-a',
      });
      expect(res.status).toBe(204);
    });

    it('different publisher cannot delete another publisher event', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      const res = await deleteAs('pub-channel', event.id, {
        scope: 'publish',
        channel: 'pub-channel',
        sub: 'agent-b',
      });
      expect(res.status).toBe(403);
    });

    it('subscribe token cannot delete events even with matching sub', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      const res = await deleteAs('pub-channel', event.id, {
        scope: 'subscribe',
        channel: 'pub-channel',
        sub: 'agent-a',
      });
      expect(res.status).toBe(403);
    });

    it('unauthenticated request is rejected', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      const res = await app.request(
        `/api/v1/channels/pub-channel/events/${event.id}`,
        { method: 'DELETE' },
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET },
      );
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent event', async () => {
      const res = await deleteAs('pub-channel', '01NONEXISTENT00000000000000', {
        scope: 'admin',
      });
      expect(res.status).toBe(404);
    });

    it('cannot delete event via wrong channel', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      // Try deleting via priv-channel — event belongs to pub-channel
      const res = await deleteAs('priv-channel', event.id, { scope: 'admin' });
      expect(res.status).toBe(404);
    });

    it('token with no sub cannot delete non-admin events', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      // Token with no sub field — callerId will be null, won't match publisher_id
      const res = await deleteAs('pub-channel', event.id, {
        scope: 'publish',
        channel: 'pub-channel',
      });
      expect(res.status).toBe(403);
    });

    it('publish token scoped to wrong channel cannot delete', async () => {
      const event = await publishAs('pub-channel', 'agent-a');

      const res = await deleteAs('pub-channel', event.id, {
        scope: 'publish',
        channel: 'other-channel',
        sub: 'agent-a',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('webhook delivery headers', () => {
    it('includes X-Zooid-Server header in webhook deliveries', async () => {
      // Register a webhook for the channel
      await createWebhook(env.DB, {
        channelId: 'pub-channel',
        url: 'https://consumer.example.com/hook',
      });

      const captured: { url: string; headers: Record<string, string> }[] = [];
      const mockFetch = vi.fn(
        async (url: string | URL | Request, init?: RequestInit) => {
          const headers: Record<string, string> = {};
          if (init?.headers) {
            for (const [k, v] of Object.entries(
              init.headers as Record<string, string>,
            )) {
              headers[k] = v;
            }
          }
          captured.push({ url: url.toString(), headers });
          return new Response('ok', { status: 200 });
        },
      ) as unknown as typeof fetch;

      await deliverToWebhooks(
        { ...env, ZOOID_JWT_SECRET: JWT_SECRET } as never,
        'pub-channel',
        { id: '01TEST000000000000000000AA', type: 'signal' },
        'https://my-server.zooid.dev',
        mockFetch,
      );

      expect(captured).toHaveLength(1);
      expect(captured[0].headers['X-Zooid-Server']).toBe(
        'https://my-server.zooid.dev',
      );
      expect(captured[0].headers['X-Zooid-Channel']).toBe('pub-channel');
      expect(captured[0].headers['X-Zooid-Event-Id']).toBe(
        '01TEST000000000000000000AA',
      );
      expect(captured[0].headers['X-Zooid-Timestamp']).toBeTruthy();
      expect(captured[0].url).toBe('https://consumer.example.com/hook');
    });

    it('includes X-Zooid-Signature when signing key is configured', async () => {
      await createWebhook(env.DB, {
        channelId: 'pub-channel',
        url: 'https://consumer.example.com/hook',
      });

      // Generate a test signing key
      const keyPair = await crypto.subtle.generateKey('Ed25519', true, [
        'sign',
        'verify',
      ]);
      const exported = await crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
      );
      const bytes = new Uint8Array(exported);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const signingKeyBase64 = btoa(binary);

      const captured: { headers: Record<string, string> }[] = [];
      const mockFetch = vi.fn(
        async (_url: string | URL | Request, init?: RequestInit) => {
          const headers: Record<string, string> = {};
          if (init?.headers) {
            for (const [k, v] of Object.entries(
              init.headers as Record<string, string>,
            )) {
              headers[k] = v;
            }
          }
          captured.push({ headers });
          return new Response('ok', { status: 200 });
        },
      ) as unknown as typeof fetch;

      await deliverToWebhooks(
        {
          ...env,
          ZOOID_JWT_SECRET: JWT_SECRET,
          ZOOID_SIGNING_KEY: signingKeyBase64,
        } as never,
        'pub-channel',
        { id: '01TEST000000000000000000BB', type: 'alert' },
        'https://my-server.zooid.dev',
        mockFetch,
      );

      expect(captured).toHaveLength(1);
      expect(captured[0].headers['X-Zooid-Server']).toBe(
        'https://my-server.zooid.dev',
      );
      expect(captured[0].headers['X-Zooid-Signature']).toBeTruthy();
    });
  });
});
