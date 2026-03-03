import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execaNode } from 'execa';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Path to the built CLI entry point
const CLI_PATH = path.resolve(__dirname, '../dist/index.js');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-e2e-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function cli(args: string[]) {
  return execaNode(CLI_PATH, args, {
    env: { ZOOID_CONFIG_DIR: tmpDir },
    reject: false,
  });
}

describe('CLI E2E', () => {
  describe('--help', () => {
    it('prints help and exits 0', async () => {
      const result = await cli(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Pub/sub for AI agents');
      expect(result.stdout).toContain('dev');
      expect(result.stdout).toContain('channel');
      expect(result.stdout).toContain('publish');
      expect(result.stdout).toContain('subscribe');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('config');
      expect(result.stdout).toContain('token');
    });
  });

  describe('--version', () => {
    it('prints version and exits 0', async () => {
      const result = await cli(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('config set + get', () => {
    it('sets and gets server URL', async () => {
      const set = await cli([
        'config',
        'set',
        'server',
        'https://my-zooid.workers.dev',
      ]);
      expect(set.exitCode).toBe(0);
      expect(set.stdout).toContain('Set server');

      const get = await cli(['config', 'get', 'server']);
      expect(get.exitCode).toBe(0);
      expect(get.stdout).toContain('https://my-zooid.workers.dev');
    });

    it('sets and gets admin-token', async () => {
      await cli(['config', 'set', 'server', 'https://my-zooid.workers.dev']);
      await cli(['config', 'set', 'admin-token', 'eyJ-test-token']);

      const get = await cli(['config', 'get', 'admin-token']);
      expect(get.exitCode).toBe(0);
      expect(get.stdout).toContain('eyJ-test-token');
    });

    it('config file persists between commands', async () => {
      await cli(['config', 'set', 'server', 'https://a.com']);
      await cli(['config', 'set', 'admin-token', 'tok123']);

      const raw = fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8');
      const config = JSON.parse(raw);
      expect(config.current).toBe('https://a.com');
      expect(config.servers['https://a.com'].admin_token).toBe('tok123');
    });

    it('rejects unknown config key', async () => {
      const result = await cli(['config', 'set', 'banana', 'yellow']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown config key');
    });
  });

  describe('error: no server configured', () => {
    it('channel list fails gracefully', async () => {
      const result = await cli(['channel', 'list']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No server configured');
    });

    it('status fails gracefully', async () => {
      const result = await cli(['status']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No server configured');
    });

    it('publish fails gracefully', async () => {
      const result = await cli(['publish', 'test-ch', '--data', '{}']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No server configured');
    });
  });

  describe('token', () => {
    it('fails gracefully without server', async () => {
      const result = await cli(['token', 'admin']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No server configured');
    });

    it('rejects invalid scope', async () => {
      await cli(['config', 'set', 'server', 'https://fake.workers.dev']);
      const result = await cli(['token', 'banana']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid scope');
    });
  });

  describe('channel --help', () => {
    it('prints channel subcommands', async () => {
      const result = await cli(['channel', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('create');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('delete');
    });
  });

  describe('tail --token', () => {
    it('accepts --token flag and uses it for auth', async () => {
      // Set up a server config so createClient doesn't fail on missing server
      await cli(['config', 'set', 'server', 'https://fake.workers.dev']);

      const result = await cli([
        'tail',
        'private-channel',
        '--token',
        'eyJ-custom-token',
        '-n',
        '1',
      ]);

      // It should fail with a network error (tried to connect), NOT "No server configured"
      // This proves the CLI wired --token through to createClient
      expect(result.exitCode).toBe(1);
      expect(result.stderr).not.toContain('No server configured');
    });
  });

  describe('tail --unseen', () => {
    it('errors when channel has never been tailed', async () => {
      await cli(['config', 'set', 'server', 'https://fake.workers.dev']);

      const result = await cli(['tail', 'never-tailed', '--unseen']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No tail history');
    });

    it('uses last_tailed_at from before the current tail, not the freshly written one', async () => {
      await cli(['config', 'set', 'server', 'https://fake.workers.dev']);

      // Seed tail history with a known past timestamp
      const pastTime = '2025-01-01T00:00:00.000Z';
      const stateFile = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'),
      );
      stateFile.servers['https://fake.workers.dev'].channels = {
        'my-channel': {
          stats: {
            num_tails: 1,
            first_tailed_at: pastTime,
            last_tailed_at: pastTime,
          },
        },
      };
      fs.writeFileSync(
        path.join(tmpDir, 'state.json'),
        JSON.stringify(stateFile, null, 2),
      );

      const result = await cli(['tail', 'my-channel', '--unseen', '-n', '1']);

      // It will fail with a network error (no real server), but the error
      // should NOT be "No tail history" — that means --unseen resolved OK.
      // And the state file should show last_tailed_at was updated to now,
      // proving resolveAndRecord ran, but --unseen read the old timestamp.
      expect(result.stderr).not.toContain('No tail history');

      const updated = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'),
      );
      const stats =
        updated.servers['https://fake.workers.dev'].channels['my-channel']
          .stats;
      // recordTailHistory ran and bumped the count
      expect(stats.num_tails).toBe(2);
      // last_tailed_at was updated to something after our seeded past time
      expect(stats.last_tailed_at).not.toBe(pastTime);
    });
  });

  describe('error telemetry', () => {
    it('writes error message to telemetry queue on command failure', async () => {
      const result = await cli(['publish', 'test-ch', '--data', '{}']);
      expect(result.exitCode).toBe(1);

      const queuePath = path.join(tmpDir, 'telemetry.json');
      const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
      expect(queue).toHaveLength(1);
      expect(queue[0].command).toBe('publish');
      expect(queue[0].exit_code).toBe(1);
      expect(queue[0].error).toContain('No server configured');
    });

    it('does not include error field on successful commands', async () => {
      const result = await cli(['config', 'set', 'server', 'https://test.dev']);
      expect(result.exitCode).toBe(0);

      const queuePath = path.join(tmpDir, 'telemetry.json');
      const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
      expect(queue).toHaveLength(1);
      expect(queue[0].command).toBe('config set');
      expect(queue[0].exit_code).toBe(0);
      expect(queue[0].error).toBeUndefined();
    });
  });
});
