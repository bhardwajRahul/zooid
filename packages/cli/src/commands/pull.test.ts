import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPull } from './pull';

let tmpDir: string;
let origCwd: string;

function makeMockClient() {
  return {
    listChannels: vi.fn().mockResolvedValue([]),
    listRoles: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-pull-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.ZOOID_CONFIG_DIR = tmpDir;
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  delete process.env.ZOOID_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readWorkforce(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
  );
}

describe('runPull()', () => {
  it('returns empty array when server has no channels', async () => {
    const client = makeMockClient();
    const result = await runPull(client as any);
    expect(result).toEqual([]);
  });

  it('writes channel definitions to .zooid/workforce.json', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      {
        id: 'signals',
        name: 'Trading Signals',
        description: 'Processed signals',
        is_public: false,
        config: { strict_types: true },
        event_count: 10,
        last_event_id: null,
        tags: [],
      },
      {
        id: 'market-data',
        name: 'market-data',
        description: null,
        is_public: true,
        config: null,
        event_count: 0,
        last_event_id: null,
        tags: [],
      },
    ]);

    const result = await runPull(client as any);

    expect(result).toEqual(['signals', 'market-data']);

    const wf = readWorkforce() as {
      channels: Record<string, Record<string, unknown>>;
    };
    expect(wf.channels.signals.visibility).toBe('private');
    expect(wf.channels.signals.name).toBe('Trading Signals');
    expect(wf.channels.signals.description).toBe('Processed signals');
    expect(wf.channels.signals.config).toEqual({ strict_types: true });

    expect(wf.channels['market-data'].visibility).toBe('public');
    expect(wf.channels['market-data'].name).toBeUndefined(); // name === id, omitted
  });

  it('creates .zooid/workforce.json if it does not exist', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      {
        id: 'test',
        name: 'Test',
        description: null,
        is_public: true,
        config: null,
        event_count: 0,
        last_event_id: null,
        tags: [],
      },
    ]);

    await runPull(client as any);

    expect(fs.existsSync(path.join(tmpDir, '.zooid', 'workforce.json'))).toBe(
      true,
    );
  });

  it('pulls roles from server into .zooid/workforce.json', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([]);
    client.listRoles.mockResolvedValueOnce([
      { id: 'analyst', scopes: ['sub:market-data', 'pub:signals'] },
      { id: 'reviewer', name: 'Reviewer', scopes: ['sub:*'] },
    ]);

    await runPull(client as any);

    const wf = readWorkforce() as {
      roles: Record<string, Record<string, unknown>>;
    };
    expect(wf.roles.analyst.scopes).toEqual(['sub:market-data', 'pub:signals']);
    expect(wf.roles.reviewer.name).toBe('Reviewer');
    expect(wf.roles.reviewer.scopes).toEqual(['sub:*']);
  });

  it('silently skips roles if server does not support roles endpoint', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([]);
    client.listRoles.mockRejectedValueOnce(new Error('404'));

    // Should not throw
    const result = await runPull(client as any);
    expect(result).toEqual([]);
  });
});
