import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseChannelUrl, resolveChannel } from './client';
import type { ZooidConfigFile } from './config';

let tmpDir: string;

vi.mock('@zooid/sdk', () => ({
  ZooidClient: vi.fn((opts: { server: string; token?: string }) => ({
    _server: opts.server,
    _token: opts.token,
  })),
}));

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-test-'));
  vi.stubEnv('ZOOID_CONFIG_DIR', tmpDir);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(file: ZooidConfigFile) {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(file));
}

function readConfig(): ZooidConfigFile {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'));
}

describe('parseChannelUrl', () => {
  it('returns null for plain channel IDs', () => {
    expect(parseChannelUrl('my-channel')).toBeNull();
  });

  it('returns null for non-URL strings', () => {
    expect(parseChannelUrl('not-a-url')).toBeNull();
    expect(parseChannelUrl('')).toBeNull();
  });

  it('parses simple server/channel format', () => {
    const result = parseChannelUrl('https://alice.zooid.dev/alpha-signals');
    expect(result).toEqual({
      server: 'https://alice.zooid.dev',
      channelId: 'alpha-signals',
    });
  });

  it('parses /channels/ format for backward compat', () => {
    const result = parseChannelUrl(
      'https://other.workers.dev/channels/signals',
    );
    expect(result).toEqual({
      server: 'https://other.workers.dev',
      channelId: 'signals',
    });
  });

  it('parses /channels/ URL with trailing path segments', () => {
    const result = parseChannelUrl(
      'https://other.workers.dev/channels/signals/events',
    );
    expect(result).toEqual({
      server: 'https://other.workers.dev',
      channelId: 'signals',
    });
  });

  it('returns null for URLs with multiple non-channels segments', () => {
    expect(parseChannelUrl('https://example.com/other/path')).toBeNull();
  });

  it('handles URLs with ports', () => {
    const result = parseChannelUrl('http://localhost:8787/test-ch');
    expect(result).toEqual({
      server: 'http://localhost:8787',
      channelId: 'test-ch',
    });
  });

  it('returns null for bare origin with no path', () => {
    expect(parseChannelUrl('https://example.com')).toBeNull();
    expect(parseChannelUrl('https://example.com/')).toBeNull();
  });

  it('parses bare domain/channel without protocol', () => {
    const result = parseChannelUrl('beno.zooid.dev/daily-haiku');
    expect(result).toEqual({
      server: 'https://beno.zooid.dev',
      channelId: 'daily-haiku',
    });
  });

  it('parses bare domain with /channels/ path without protocol', () => {
    const result = parseChannelUrl('beno.zooid.dev/channels/my-feed');
    expect(result).toEqual({
      server: 'https://beno.zooid.dev',
      channelId: 'my-feed',
    });
  });

  it('returns null for bare domain without a path', () => {
    expect(parseChannelUrl('beno.zooid.dev')).toBeNull();
  });

  it('does not treat plain channel IDs with hyphens as domains', () => {
    expect(parseChannelUrl('my-channel')).toBeNull();
    expect(parseChannelUrl('daily-haiku')).toBeNull();
  });

  it('parses localhost:port/channel without protocol', () => {
    const result = parseChannelUrl('localhost:8787/daily-haiku');
    expect(result).toEqual({
      server: 'http://localhost:8787',
      channelId: 'daily-haiku',
    });
  });

  it('uses http for private IPs without protocol', () => {
    expect(parseChannelUrl('192.168.1.50:8787/signals')).toEqual({
      server: 'http://192.168.1.50:8787',
      channelId: 'signals',
    });
    expect(parseChannelUrl('10.0.0.1:3000/my-feed')).toEqual({
      server: 'http://10.0.0.1:3000',
      channelId: 'my-feed',
    });
  });
});

describe('resolveChannel', () => {
  describe('with plain channel ID', () => {
    it('uses current server and publish token from config', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: {
          'https://my.workers.dev': {
            admin_token: 'admin-tok',
            channels: {
              signals: { publish_token: 'pub-tok' },
            },
          },
        },
      });

      const result = resolveChannel('signals', { tokenType: 'publish' });
      expect(result.channelId).toBe('signals');
      expect(result.server).toBe('https://my.workers.dev');
      expect(result.tokenSaved).toBe(false);
      expect((result.client as any)._token).toBe('pub-tok');
    });

    it('falls back to admin token when no channel token', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: {
          'https://my.workers.dev': {
            admin_token: 'admin-tok',
          },
        },
      });

      const result = resolveChannel('signals', { tokenType: 'publish' });
      expect((result.client as any)._token).toBe('admin-tok');
    });

    it('saves explicit --token to config', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: { 'https://my.workers.dev': {} },
      });

      const result = resolveChannel('signals', {
        token: 'my-pub-tok',
        tokenType: 'publish',
      });

      expect(result.tokenSaved).toBe(true);
      expect((result.client as any)._token).toBe('my-pub-tok');

      const config = readConfig();
      expect(
        config.servers!['https://my.workers.dev'].channels!.signals
          .publish_token,
      ).toBe('my-pub-tok');
    });

    it('throws when no server configured', () => {
      writeConfig({});
      expect(() => resolveChannel('signals')).toThrow('No server configured');
    });
  });

  describe('with remote channel URL', () => {
    it('creates client for remote server', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: { 'https://my.workers.dev': {} },
      });

      const result = resolveChannel(
        'https://other.workers.dev/channels/their-feed',
        { token: 'remote-tok', tokenType: 'subscribe' },
      );

      expect(result.channelId).toBe('their-feed');
      expect(result.server).toBe('https://other.workers.dev');
      expect((result.client as any)._server).toBe('https://other.workers.dev');
      expect((result.client as any)._token).toBe('remote-tok');
    });

    it('saves token for remote server without switching current', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: { 'https://my.workers.dev': { admin_token: 'my-admin' } },
      });

      resolveChannel('https://other.workers.dev/channels/feed', {
        token: 'remote-pub-tok',
        tokenType: 'publish',
      });

      const config = readConfig();
      // Token saved under remote server
      expect(
        config.servers!['https://other.workers.dev'].channels!.feed
          .publish_token,
      ).toBe('remote-pub-tok');
      // Current server NOT switched
      expect(config.current).toBe('https://my.workers.dev');
      // Original server config preserved
      expect(config.servers!['https://my.workers.dev'].admin_token).toBe(
        'my-admin',
      );
    });

    it('looks up saved token on subsequent calls without --token', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: {
          'https://my.workers.dev': {},
          'https://other.workers.dev': {
            channels: {
              feed: { subscribe_token: 'saved-sub-tok' },
            },
          },
        },
      });

      const result = resolveChannel('https://other.workers.dev/channels/feed', {
        tokenType: 'subscribe',
      });

      expect(result.tokenSaved).toBe(false);
      expect((result.client as any)._token).toBe('saved-sub-tok');
    });

    it('returns no token when none saved and none provided', () => {
      writeConfig({
        current: 'https://my.workers.dev',
        servers: { 'https://my.workers.dev': {} },
      });

      const result = resolveChannel(
        'https://other.workers.dev/channels/public-feed',
        { tokenType: 'subscribe' },
      );

      expect((result.client as any)._token).toBeUndefined();
      expect(result.tokenSaved).toBe(false);
    });
  });
});
