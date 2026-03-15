import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { setupTestDb, cleanTestDb } from '../test-utils';
import { D1ServerStorage } from './d1-server';
import type { ServerStorage } from './server-types';

describe('D1ServerStorage', () => {
  let storage: ServerStorage;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    storage = new D1ServerStorage(env.DB);
  });

  // ── Channels ──────────────────────────────────────────────

  describe('channels', () => {
    it('creates a channel and returns it', async () => {
      const channel = await storage.createChannel({
        id: 'test-chan',
        name: 'Test Channel',
        description: 'A test channel',
        tags: ['ai', 'test'],
        is_public: true,
      });

      expect(channel.id).toBe('test-chan');
      expect(channel.name).toBe('Test Channel');
      expect(channel.description).toBe('A test channel');
      expect(channel.is_public).toBe(1); // D1 stores as INTEGER
    });

    it('gets a channel by ID', async () => {
      await storage.createChannel({ id: 'my-chan', name: 'My Channel' });
      const channel = await storage.getChannel('my-chan');
      expect(channel).not.toBeNull();
      expect(channel!.id).toBe('my-chan');
    });

    it('returns null for non-existent channel', async () => {
      const channel = await storage.getChannel('nope');
      expect(channel).toBeNull();
    });

    it('lists all channels', async () => {
      await storage.createChannel({ id: 'chan-one', name: 'One' });
      await storage.createChannel({ id: 'chan-two', name: 'Two' });
      const list = await storage.listChannels();
      expect(list).toHaveLength(2);
    });

    it('updates a channel', async () => {
      await storage.createChannel({ id: 'upd-chan', name: 'Original' });
      const updated = await storage.updateChannel('upd-chan', {
        name: 'Updated',
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
    });

    it('returns null when updating non-existent channel', async () => {
      const result = await storage.updateChannel('nope', { name: 'X' });
      expect(result).toBeNull();
    });

    it('deletes a channel', async () => {
      await storage.createChannel({ id: 'del-chan', name: 'Delete Me' });
      const deleted = await storage.deleteChannel('del-chan');
      expect(deleted).toBe(true);
      const gone = await storage.getChannel('del-chan');
      expect(gone).toBeNull();
    });

    it('returns false when deleting non-existent channel', async () => {
      const deleted = await storage.deleteChannel('nope');
      expect(deleted).toBe(false);
    });
  });

  // ── Server Metadata ───────────────────────────────────────

  describe('server metadata', () => {
    it('returns null when no metadata exists', async () => {
      const meta = await storage.getServerMeta();
      expect(meta).toBeNull();
    });

    it('creates server metadata via upsert', async () => {
      const meta = await storage.upsertServerMeta({ name: 'My Server' });
      expect(meta.name).toBe('My Server');
    });

    it('updates existing server metadata', async () => {
      await storage.upsertServerMeta({ name: 'V1' });
      const meta = await storage.upsertServerMeta({
        name: 'V2',
        description: 'Updated',
      });
      expect(meta.name).toBe('V2');
      expect(meta.description).toBe('Updated');
    });
  });

  // ── Trusted Keys ──────────────────────────────────────────

  describe('trusted keys', () => {
    it('adds a trusted key', async () => {
      const key = await storage.addTrustedKey({
        kid: 'key-1',
        x: 'base64url-public-key',
        issuer: 'test.dev',
      });
      expect(key.kid).toBe('key-1');
      expect(key.x).toBe('base64url-public-key');
    });

    it('lists trusted keys', async () => {
      await storage.addTrustedKey({ kid: 'k1', x: 'pk1' });
      await storage.addTrustedKey({ kid: 'k2', x: 'pk2' });
      const keys = await storage.listTrustedKeys();
      expect(keys).toHaveLength(2);
    });

    it('gets a trusted key by kid', async () => {
      await storage.addTrustedKey({ kid: 'find-me', x: 'pk' });
      const key = await storage.getTrustedKey('find-me');
      expect(key).not.toBeNull();
      expect(key!.kid).toBe('find-me');
    });

    it('returns null for non-existent key', async () => {
      const key = await storage.getTrustedKey('nope');
      expect(key).toBeNull();
    });

    it('removes a trusted key', async () => {
      await storage.addTrustedKey({ kid: 'rm-key', x: 'pk' });
      const removed = await storage.removeTrustedKey('rm-key');
      expect(removed).toBe(true);
      const gone = await storage.getTrustedKey('rm-key');
      expect(gone).toBeNull();
    });

    it('returns false when removing non-existent key', async () => {
      const removed = await storage.removeTrustedKey('nope');
      expect(removed).toBe(false);
    });
  });
});
