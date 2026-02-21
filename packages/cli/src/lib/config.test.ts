import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadConfig,
  saveConfig,
  switchServer,
  loadConfigFile,
  getConfigPath,
  loadDirectoryToken,
  saveDirectoryToken,
  recordTailHistory,
  type ZooidConfigFile,
} from './config';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-test-'));
  vi.stubEnv('ZOOID_CONFIG_DIR', tmpDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('config', () => {
  describe('getConfigPath()', () => {
    it('returns path inside ZOOID_CONFIG_DIR when set', () => {
      const p = getConfigPath();
      expect(p).toBe(path.join(tmpDir, 'config.json'));
    });
  });

  describe('loadConfig()', () => {
    it('returns empty config when file does not exist', () => {
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('loads config for current server', () => {
      const file: ZooidConfigFile = {
        current: 'https://example.com',
        servers: {
          'https://example.com': {
            admin_token: 'tok',
            worker_url: 'https://example.workers.dev',
          },
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));

      const config = loadConfig();
      expect(config.server).toBe('https://example.com');
      expect(config.admin_token).toBe('tok');
    });

    it('returns empty config on invalid JSON', () => {
      fs.writeFileSync(path.join(tmpDir, 'config.json'), 'not json');
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('auto-migrates old flat format', () => {
      const old = {
        server: 'https://old.com',
        admin_token: 'old-tok',
        worker_url: 'https://old.workers.dev',
        channels: { ch1: { publish_token: 'pt' } },
      };
      fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(old));

      const config = loadConfig();
      expect(config.server).toBe('https://old.com');
      expect(config.admin_token).toBe('old-tok');

      // Verify file was migrated on disk
      const raw = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');
      const migrated = JSON.parse(raw);
      expect(migrated.current).toBe('https://old.com');
      expect(migrated.servers['https://old.com'].admin_token).toBe('old-tok');
      expect(migrated.server).toBeUndefined();
    });
  });

  describe('saveConfig()', () => {
    it('creates file and saves under server key', () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });

      saveConfig(
        { admin_token: 'abc', channels: { 'my-ch': { publish_token: 'pt' } } },
        'https://test.com',
      );

      const raw = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');
      const file = JSON.parse(raw) as ZooidConfigFile;
      expect(file.current).toBe('https://test.com');
      expect(file.servers!['https://test.com'].admin_token).toBe('abc');
      expect(
        file.servers!['https://test.com'].channels!['my-ch'].publish_token,
      ).toBe('pt');
    });

    it('merges into existing server entry', () => {
      saveConfig({ admin_token: 'old' }, 'https://a.com');
      saveConfig({ worker_url: 'https://a.workers.dev' }, 'https://a.com');

      const file = loadConfigFile();
      expect(file.servers!['https://a.com'].admin_token).toBe('old');
      expect(file.servers!['https://a.com'].worker_url).toBe(
        'https://a.workers.dev',
      );
    });

    it('keeps separate servers independent', () => {
      saveConfig({ admin_token: 'tok-a' }, 'https://a.com');
      saveConfig({ admin_token: 'tok-b' }, 'https://b.com');

      const file = loadConfigFile();
      expect(file.servers!['https://a.com'].admin_token).toBe('tok-a');
      expect(file.servers!['https://b.com'].admin_token).toBe('tok-b');
      expect(file.current).toBe('https://b.com');
    });
  });

  describe('switchServer()', () => {
    it('sets current to new URL', () => {
      saveConfig({ admin_token: 'tok' }, 'https://a.com');
      switchServer('https://b.com');

      const file = loadConfigFile();
      expect(file.current).toBe('https://b.com');
      expect(file.servers!['https://b.com']).toEqual({});
      expect(file.servers!['https://a.com'].admin_token).toBe('tok');
    });
  });

  describe('loadDirectoryToken()', () => {
    it('returns undefined when no config exists', () => {
      expect(loadDirectoryToken()).toBeUndefined();
    });

    it('returns undefined when directory_token is not set', () => {
      const file: ZooidConfigFile = { current: 'https://a.com', servers: {} };
      fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));
      expect(loadDirectoryToken()).toBeUndefined();
    });

    it('returns the directory token when set', () => {
      const file: ZooidConfigFile = {
        current: 'https://a.com',
        servers: {},
        directory_token: 'zd_test123',
      };
      fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));
      expect(loadDirectoryToken()).toBe('zd_test123');
    });
  });

  describe('saveDirectoryToken()', () => {
    it('saves directory token to config file', () => {
      saveConfig({ admin_token: 'tok' }, 'https://a.com');
      saveDirectoryToken('zd_newtoken');

      const raw = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');
      const file = JSON.parse(raw) as ZooidConfigFile;
      expect(file.directory_token).toBe('zd_newtoken');
      // Preserves existing config
      expect(file.servers!['https://a.com'].admin_token).toBe('tok');
    });

    it('creates config file if it does not exist', () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      saveDirectoryToken('zd_fresh');

      const raw = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');
      const file = JSON.parse(raw) as ZooidConfigFile;
      expect(file.directory_token).toBe('zd_fresh');
    });

    it('overwrites existing directory token', () => {
      const file: ZooidConfigFile = {
        current: 'https://a.com',
        servers: {},
        directory_token: 'zd_old',
      };
      fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));

      saveDirectoryToken('zd_new');

      expect(loadDirectoryToken()).toBe('zd_new');
    });
  });

  describe('saveConfig() deep merge', () => {
    it('deep merges individual channel entries preserving existing fields', () => {
      saveConfig(
        { channels: { ch1: { publish_token: 'pt' } } },
        'https://a.com',
      );
      saveConfig(
        { channels: { ch1: { subscribe_token: 'st' } } },
        'https://a.com',
      );

      const file = loadConfigFile();
      const ch1 = file.servers!['https://a.com'].channels!.ch1;
      expect(ch1.publish_token).toBe('pt');
      expect(ch1.subscribe_token).toBe('st');
    });
  });

  describe('recordTailHistory()', () => {
    it('creates channel entry with stats for first tail', () => {
      saveConfig({}, 'https://a.com');
      recordTailHistory('my-channel', 'https://a.com');

      const file = loadConfigFile();
      const stats =
        file.servers!['https://a.com'].channels!['my-channel'].stats!;
      expect(stats.num_tails).toBe(1);
      expect(stats.first_tailed_at).toBeDefined();
      expect(stats.last_tailed_at).toBe(stats.first_tailed_at);
    });

    it('increments num_tails and updates last_tailed_at', () => {
      saveConfig({}, 'https://a.com');
      recordTailHistory('ch', 'https://a.com');

      const file1 = loadConfigFile();
      const first =
        file1.servers!['https://a.com'].channels!['ch'].stats!.first_tailed_at;

      recordTailHistory('ch', 'https://a.com');

      const file2 = loadConfigFile();
      const stats = file2.servers!['https://a.com'].channels!['ch'].stats!;
      expect(stats.num_tails).toBe(2);
      expect(stats.first_tailed_at).toBe(first);
    });

    it('preserves existing tokens when recording stats', () => {
      saveConfig(
        { channels: { ch: { publish_token: 'pt', subscribe_token: 'st' } } },
        'https://a.com',
      );
      recordTailHistory('ch', 'https://a.com');

      const file = loadConfigFile();
      const ch = file.servers!['https://a.com'].channels!['ch'];
      expect(ch.publish_token).toBe('pt');
      expect(ch.subscribe_token).toBe('st');
      expect(ch.stats!.num_tails).toBe(1);
    });

    it('stores channel name when provided', () => {
      saveConfig({}, 'https://a.com');
      recordTailHistory('ch', 'https://a.com', 'My Channel');

      const file = loadConfigFile();
      expect(file.servers!['https://a.com'].channels!['ch'].name).toBe(
        'My Channel',
      );
    });

    it('creates server entry when it does not exist', () => {
      recordTailHistory('ch', 'https://new.com');

      const file = loadConfigFile();
      expect(file.servers!['https://new.com'].channels!['ch'].stats!.num_tails).toBe(1);
    });

    it('silently skips when no server is resolvable', () => {
      expect(() => recordTailHistory('ch')).not.toThrow();
    });
  });
});
