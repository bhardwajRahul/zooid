import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runChannelCreate,
  runChannelList,
  runChannelUpdate,
  runChannelDelete,
} from './channel';

let tmpDir: string;
let origCwd: string;
const mockClient = {
  createChannel: vi.fn(),
  listChannels: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
};

vi.mock('@zooid/sdk', () => ({
  ZooidClient: vi.fn(() => mockClient),
}));

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-test-'));
  origCwd = process.cwd();
  vi.stubEnv('ZOOID_CONFIG_DIR', tmpDir);
  vi.clearAllMocks();
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const TEST_SERVER = 'https://test.workers.dev';

function writeConfig(overrides = {}) {
  const config = {
    current: TEST_SERVER,
    servers: {
      [TEST_SERVER]: {
        admin_token: 'admin-jwt',
        ...overrides,
      },
    },
  };
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(config));
}

describe('channel commands', () => {
  describe('runChannelCreate()', () => {
    it('creates a public channel and saves tokens to config', async () => {
      writeConfig();
      mockClient.createChannel.mockResolvedValueOnce({
        id: 'signals',
        token: 'channel-tok',
      });

      const result = await runChannelCreate('signals', {
        name: 'Signals',
        public: true,
        description: 'Test channel',
      });

      expect(mockClient.createChannel).toHaveBeenCalledWith({
        id: 'signals',
        name: 'Signals',
        is_public: true,
        description: 'Test channel',
      });
      expect(result.id).toBe('signals');
      expect(result.token).toBe('channel-tok');

      const raw = fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8');
      const file = JSON.parse(raw);
      const serverEntry = file.servers[TEST_SERVER];
      expect(serverEntry.channels.signals.token).toBe('channel-tok');
    });

    it('throws when no server configured', async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'state.json'), '{}');

      await expect(runChannelCreate('test', { name: 'Test' })).rejects.toThrow(
        'No server configured',
      );
    });
  });

  describe('runChannelList()', () => {
    it('returns list of channels', async () => {
      writeConfig();
      mockClient.listChannels.mockResolvedValueOnce([
        { id: 'ch1', name: 'Channel 1', is_public: true, event_count: 5 },
        { id: 'ch2', name: 'Channel 2', is_public: false, event_count: 0 },
      ]);

      const channels = await runChannelList();
      expect(channels).toHaveLength(2);
      expect(channels[0].id).toBe('ch1');
    });
  });

  describe('runChannelUpdate()', () => {
    it('updates a channel via the SDK client', async () => {
      writeConfig();
      mockClient.updateChannel.mockResolvedValueOnce({
        id: 'signals',
        name: 'New Name',
        description: null,
        tags: ['ai'],
        is_public: false,
        config: null,
      });

      const result = await runChannelUpdate(
        'signals',
        { name: 'New Name', is_public: false },
        mockClient as any,
      );

      expect(mockClient.updateChannel).toHaveBeenCalledWith('signals', {
        name: 'New Name',
        is_public: false,
      });
      expect(result.name).toBe('New Name');
      expect(result.is_public).toBe(false);
    });

    it('throws when the channel does not exist', async () => {
      writeConfig();
      mockClient.updateChannel.mockRejectedValueOnce(
        new Error('Channel not found'),
      );

      await expect(
        runChannelUpdate('nonexistent', { name: 'Nope' }, mockClient as any),
      ).rejects.toThrow('Channel not found');
    });
  });

  describe('runChannelDelete()', () => {
    it('deletes a channel via the SDK client', async () => {
      writeConfig();
      mockClient.deleteChannel.mockResolvedValueOnce(undefined);

      await runChannelDelete('signals', mockClient as any);

      expect(mockClient.deleteChannel).toHaveBeenCalledWith('signals');
    });

    it('removes channel from local config', async () => {
      writeConfig({
        channels: {
          signals: { publish_token: 'pt', subscribe_token: 'st' },
          other: { publish_token: 'pt2' },
        },
      });
      mockClient.deleteChannel.mockResolvedValueOnce(undefined);

      await runChannelDelete('signals');

      const raw = fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8');
      const file = JSON.parse(raw);
      expect(file.servers[TEST_SERVER].channels.signals).toBeUndefined();
      expect(file.servers[TEST_SERVER].channels.other).toBeDefined();
    });

    it('throws when the channel does not exist', async () => {
      writeConfig();
      mockClient.deleteChannel.mockRejectedValueOnce(
        new Error('Channel not found'),
      );

      await expect(
        runChannelDelete('nonexistent', mockClient as any),
      ).rejects.toThrow('Channel not found');
    });
  });
});
