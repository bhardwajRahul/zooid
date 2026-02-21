import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../packages/server/src/index';
import { ZooidClient } from '../../packages/sdk/src/client';
import { verifyWebhook } from '../../packages/sdk/src/verify';
import { createToken } from '../../packages/server/src/lib/jwt';
import {
  generateKeyPair,
  exportPublicKey,
  signPayload,
} from '../../packages/server/src/lib/signing';
import { setupTestDb, cleanTestDb } from '../../packages/server/src/test-utils';

const JWT_SECRET = 'test-jwt-secret';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Helper: create a mini fetch that routes through the Hono app
function createTestFetch(extraEnv: Record<string, string> = {}) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const path = new URL(url).pathname + new URL(url).search;
    return app.request(path, init ?? {}, {
      ...env,
      ZOOID_JWT_SECRET: JWT_SECRET,
      ...extraEnv,
    });
  };
}

describe('SDK Integration Tests', () => {
  let testFetch: ReturnType<typeof createTestFetch>;

  beforeAll(async () => {
    await setupTestDb();
    testFetch = createTestFetch();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  describe('channel lifecycle', () => {
    it('creates a channel, lists it, and adds a publisher', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const client = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      // Create channel
      const created = await client.createChannel({
        id: 'test-channel',
        name: 'Test Channel',
        description: 'Integration test',
        is_public: true,
      });
      expect(created.id).toBe('test-channel');
      expect(created.publish_token).toBeTruthy();
      expect(created.subscribe_token).toBeTruthy();

      // List channels
      const channels = await client.listChannels();
      expect(channels).toHaveLength(1);
      expect(channels[0].id).toBe('test-channel');
      expect(channels[0].event_count).toBe(0);

      // Add publisher
      const publisher = await client.addPublisher('test-channel', 'my-bot');
      expect(publisher.name).toBe('my-bot');
      expect(publisher.publish_token).toBeTruthy();
    });
  });

  describe('publish and poll', () => {
    it('publishes events and polls them back', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      const created = await admin.createChannel({
        id: 'pub-test',
        name: 'Pub Test',
        is_public: true,
      });

      // Publish with the publish token
      const publisher = new ZooidClient({
        server: 'https://test.local',
        token: created.publish_token,
        fetch: testFetch,
      });

      const event = await publisher.publish('pub-test', {
        type: 'signal',
        data: { market: 'BTC', shift: 0.05 },
      });
      expect(event.id).toBeTruthy();
      expect(event.type).toBe('signal');

      // Poll without auth (public channel)
      const reader = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      const result = await reader.poll('pub-test');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('signal');
      expect(result.has_more).toBe(false);
    });

    it('publishes a batch and polls with cursor', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      const created = await admin.createChannel({
        id: 'batch-test',
        name: 'Batch',
        is_public: true,
      });

      const publisher = new ZooidClient({
        server: 'https://test.local',
        token: created.publish_token,
        fetch: testFetch,
      });

      const events = await publisher.publishBatch('batch-test', [
        { type: 'a', data: { v: 1 } },
        { type: 'b', data: { v: 2 } },
        { type: 'c', data: { v: 3 } },
      ]);
      expect(events).toHaveLength(3);

      // Poll with since anchor to enable forward pagination
      const reader = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      const page1 = await reader.poll('batch-test', {
        limit: 2,
        since: '2000-01-01T00:00:00Z',
      });
      expect(page1.events).toHaveLength(2);
      expect(page1.has_more).toBe(true);
      expect(page1.cursor).toBeTruthy();

      const page2 = await reader.poll('batch-test', { cursor: page1.cursor! });
      expect(page2.events).toHaveLength(1);
      expect(page2.has_more).toBe(false);
    });
  });

  describe('tail (one-shot read)', () => {
    it('tails latest events from a public channel', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      const created = await admin.createChannel({
        id: 'tail-test',
        name: 'Tail Test',
        is_public: true,
      });

      const publisher = new ZooidClient({
        server: 'https://test.local',
        token: created.publish_token,
        fetch: testFetch,
      });

      await publisher.publishBatch('tail-test', [
        { type: 'a', data: { v: 1 } },
        { type: 'b', data: { v: 2 } },
        { type: 'c', data: { v: 3 } },
      ]);

      // Tail without auth (public channel)
      const reader = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      const result = await reader.tail('tail-test');
      expect(result.events).toHaveLength(3);
      expect(result.events[0].type).toBe('a');
      expect(result.events[2].type).toBe('c');
    });

    it('tails with limit returns the most recent events', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      const created = await admin.createChannel({
        id: 'tail-limit',
        name: 'Tail Limit',
        is_public: true,
      });

      const publisher = new ZooidClient({
        server: 'https://test.local',
        token: created.publish_token,
        fetch: testFetch,
      });

      await publisher.publishBatch('tail-limit', [
        { type: 'a', data: { v: 1 } },
        { type: 'b', data: { v: 2 } },
        { type: 'c', data: { v: 3 } },
      ]);

      const reader = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      // tail with limit=2 returns the last 2 events in chronological order
      const result = await reader.tail('tail-limit', { limit: 2 });
      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('b');
      expect(result.events[1].type).toBe('c');
    });

    it('requires subscribe token to tail private channel', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      await admin.createChannel({
        id: 'tail-private',
        name: 'Private Tail',
        is_public: false,
      });

      const anonymous = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      await expect(anonymous.tail('tail-private')).rejects.toThrow();
    });
  });

  describe('private channels', () => {
    it('requires subscribe token to poll private channel', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      await admin.createChannel({
        id: 'private-ch',
        name: 'Private',
        is_public: false,
      });

      // Poll without token should fail
      const anonymous = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      await expect(anonymous.poll('private-ch')).rejects.toThrow();

      // Poll with subscribe token should work
      const subToken = await createToken(
        { scope: 'subscribe', channel: 'private-ch' },
        JWT_SECRET,
      );
      const subscriber = new ZooidClient({
        server: 'https://test.local',
        token: subToken,
        fetch: testFetch,
      });

      const result = await subscriber.poll('private-ch');
      expect(result.events).toEqual([]);
    });
  });

  describe('server info', () => {
    it('fetches server discovery metadata', async () => {
      const client = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      const meta = await client.getMetadata();
      expect(meta.version).toBe('0.1');
      expect(meta.algorithm).toBe('Ed25519');
      expect(meta.delivery).toContain('poll');
    });
  });

  describe('server meta', () => {
    it('returns defaults when no row exists', async () => {
      const client = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });

      const meta = await client.getServerMeta();
      expect(meta.name).toBe('Zooid');
      expect(meta.description).toBeNull();
      expect(meta.tags).toEqual([]);
    });

    it('updates and retrieves server metadata', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: testFetch,
      });

      const updated = await admin.updateServerMeta({
        name: 'My Zooid',
        description: 'Integration test server',
        tags: ['ai', 'agents'],
        owner: 'tester',
      });
      expect(updated.name).toBe('My Zooid');
      expect(updated.tags).toEqual(['ai', 'agents']);

      // Read back without auth
      const reader = new ZooidClient({
        server: 'https://test.local',
        fetch: testFetch,
      });
      const meta = await reader.getServerMeta();
      expect(meta.name).toBe('My Zooid');
      expect(meta.owner).toBe('tester');
    });
  });

  describe('directory claim', () => {
    let claimFetch: ReturnType<typeof createTestFetch>;
    let signingKeyBase64: string;
    let publicKey: CryptoKey;

    beforeAll(async () => {
      const keyPair = await generateKeyPair();
      const exported = await crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
      );
      signingKeyBase64 = arrayBufferToBase64(exported);
      publicKey = keyPair.publicKey;
      claimFetch = createTestFetch({ ZOOID_SIGNING_KEY: signingKeyBase64 });
    });

    it('creates channels and generates a valid signed claim via SDK', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: claimFetch,
      });

      // Create channels
      await admin.createChannel({
        id: 'claim-ch-a',
        name: 'Claim A',
        is_public: true,
      });
      await admin.createChannel({
        id: 'claim-ch-b',
        name: 'Claim B',
        is_public: true,
      });

      // Get claim
      const result = await admin.getClaim(['claim-ch-a', 'claim-ch-b']);
      expect(result.claim).toBeTruthy();
      expect(result.signature).toBeTruthy();

      // Decode claim
      const claimBytes = base64UrlToBytes(result.claim);
      const claimJson = new TextDecoder().decode(claimBytes);
      const claim = JSON.parse(claimJson);
      expect(claim.channels).toEqual(['claim-ch-a', 'claim-ch-b']);
      expect(claim.server_url).toBeTruthy();
      expect(claim.timestamp).toBeTruthy();

      // Verify signature
      const sigBytes = base64UrlToBytes(result.signature);
      const valid = await crypto.subtle.verify(
        'Ed25519',
        publicKey,
        sigBytes,
        claimBytes,
      );
      expect(valid).toBe(true);
    });

    it('generates a delete claim via SDK', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: claimFetch,
      });

      await admin.createChannel({
        id: 'del-ch',
        name: 'Delete Me',
        is_public: true,
      });

      const result = await admin.getClaim(['del-ch'], 'delete');
      const claimJson = new TextDecoder().decode(
        base64UrlToBytes(result.claim),
      );
      const claim = JSON.parse(claimJson);
      expect(claim.action).toBe('delete');
      expect(claim.channels).toEqual(['del-ch']);
    });

    it('rejects claim for non-existent channels via SDK', async () => {
      const adminToken = await createToken({ scope: 'admin' }, JWT_SECRET);
      const admin = new ZooidClient({
        server: 'https://test.local',
        token: adminToken,
        fetch: claimFetch,
      });

      await expect(admin.getClaim(['does-not-exist'])).rejects.toThrow();
    });

    it('rejects claim without admin token', async () => {
      const subToken = await createToken(
        { scope: 'subscribe', channel: 'any' },
        JWT_SECRET,
      );
      const subscriber = new ZooidClient({
        server: 'https://test.local',
        token: subToken,
        fetch: claimFetch,
      });

      await expect(subscriber.getClaim(['any'])).rejects.toThrow();
    });
  });

  describe('webhook verification (server signs → SDK verifies)', () => {
    it('SDK verifyWebhook accepts a signature produced by server signing', async () => {
      // Use the same key generation and signing functions the server uses
      const keyPair = await generateKeyPair();
      const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

      // Simulate what the server does when delivering a webhook
      const eventBody = JSON.stringify({
        id: '01TEST000000000000000000AA',
        channel_id: 'wh-test',
        type: 'signal',
        data: '{"price":42000}',
      });
      const timestamp = new Date().toISOString();
      const signature = await signPayload(
        keyPair.privateKey,
        timestamp,
        eventBody,
      );

      // Verify using the SDK's verifyWebhook (what a consumer would use)
      const isValid = await verifyWebhook({
        body: eventBody,
        signature,
        timestamp,
        publicKey: publicKeyBase64,
      });
      expect(isValid).toBe(true);
    });

    it('SDK verifyWebhook rejects tampered body', async () => {
      const keyPair = await generateKeyPair();
      const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

      const eventBody = JSON.stringify({
        id: '01TEST000000000000000000BB',
        type: 'signal',
        data: '{"price":42000}',
      });
      const timestamp = new Date().toISOString();
      const signature = await signPayload(
        keyPair.privateKey,
        timestamp,
        eventBody,
      );

      // Tamper with the body
      const tampered = await verifyWebhook({
        body: '{"id":"01TEST000000000000000000BB","type":"signal","data":"TAMPERED"}',
        signature,
        timestamp,
        publicKey: publicKeyBase64,
      });
      expect(tampered).toBe(false);
    });

    it('SDK verifyWebhook rejects stale signatures with maxAge', async () => {
      const keyPair = await generateKeyPair();
      const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

      const eventBody = JSON.stringify({ id: 'test', type: 'x', data: '{}' });
      const staleTimestamp = new Date(Date.now() - 600_000).toISOString();
      const signature = await signPayload(
        keyPair.privateKey,
        staleTimestamp,
        eventBody,
      );

      const isValid = await verifyWebhook({
        body: eventBody,
        signature,
        timestamp: staleTimestamp,
        publicKey: publicKeyBase64,
        maxAge: 300, // 5 min — signature is 10 min old
      });
      expect(isValid).toBe(false);
    });

    it('public key from /.well-known/zooid.json works with verifyWebhook', async () => {
      // Generate key pair and configure server with it
      const keyPair = await generateKeyPair();
      const privExported = await crypto.subtle.exportKey(
        'pkcs8',
        keyPair.privateKey,
      );
      const signingKeyBase64 = arrayBufferToBase64(privExported);

      // Export raw public key (32 bytes) — this is what ZOOID_PUBLIC_KEY holds
      const rawPubKey = await crypto.subtle.exportKey(
        'raw',
        keyPair.publicKey,
      );
      const rawPubKeyBase64 = arrayBufferToBase64(rawPubKey);

      const wellKnownFetch = createTestFetch({
        ZOOID_SIGNING_KEY: signingKeyBase64,
        ZOOID_PUBLIC_KEY: rawPubKeyBase64,
      });

      // Fetch public key from /.well-known/zooid.json (like a real consumer would)
      const client = new ZooidClient({
        server: 'https://test.local',
        fetch: wellKnownFetch,
      });
      const meta = await client.getMetadata();
      const fetchedPublicKey = meta.public_key;
      expect(fetchedPublicKey).toBeTruthy();

      // Sign a payload using the server's private key
      const eventBody = '{"type":"test","data":{}}';
      const timestamp = new Date().toISOString();
      const signature = await signPayload(
        keyPair.privateKey,
        timestamp,
        eventBody,
      );

      // Verify using the fetched public key
      const isValid = await verifyWebhook({
        body: eventBody,
        signature,
        timestamp,
        publicKey: fetchedPublicKey,
      });
      expect(isValid).toBe(true);
    });
  });
});
