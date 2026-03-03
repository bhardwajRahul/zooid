import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runTokenMint } from './token';

let tmpDir: string;
const mockClient = {
  mintToken: vi.fn(),
};

vi.mock('@zooid/sdk', () => ({
  ZooidClient: vi.fn(() => mockClient),
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

describe('token commands', () => {
  describe('runTokenMint()', () => {
    it('mints an admin token', async () => {
      writeConfig();
      mockClient.mintToken.mockResolvedValueOnce({ token: 'new-admin-jwt' });

      const result = await runTokenMint('admin', {});

      expect(mockClient.mintToken).toHaveBeenCalledWith({ scope: 'admin' });
      expect(result.token).toBe('new-admin-jwt');
    });

    it('mints a publish token with channels', async () => {
      writeConfig();
      mockClient.mintToken.mockResolvedValueOnce({ token: 'pub-jwt' });

      const result = await runTokenMint('publish', {
        channels: ['signals', 'alerts'],
      });

      expect(mockClient.mintToken).toHaveBeenCalledWith({
        scope: 'publish',
        channels: ['signals', 'alerts'],
      });
      expect(result.token).toBe('pub-jwt');
    });

    it('passes sub, name, and expiresIn', async () => {
      writeConfig();
      mockClient.mintToken.mockResolvedValueOnce({ token: 'custom-jwt' });

      await runTokenMint('subscribe', {
        channels: ['ch1'],
        sub: 'agent-42',
        name: 'My Agent',
        expiresIn: '7d',
      });

      expect(mockClient.mintToken).toHaveBeenCalledWith({
        scope: 'subscribe',
        channels: ['ch1'],
        sub: 'agent-42',
        name: 'My Agent',
        expires_in: '7d',
      });
    });

    it('throws when no server configured', async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'state.json'), '{}');

      await expect(runTokenMint('admin', {})).rejects.toThrow(
        'No server configured',
      );
    });
  });
});
