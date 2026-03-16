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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-pull-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runPull()', () => {
  it('returns empty array when server has no channels', async () => {
    const client = makeMockClient();
    const result = await runPull(client as any);
    expect(result).toEqual([]);
  });

  it('writes channel definitions to .zooid/channels/ directory', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      {
        id: 'signals',
        name: 'Trading Signals',
        description: 'Processed signals',
        is_public: false,
        config: { strict_types: true },
        event_count: 10,
        last_event_at: null,
        tags: [],
      },
      {
        id: 'market-data',
        name: 'market-data',
        description: null,
        is_public: true,
        config: null,
        event_count: 0,
        last_event_at: null,
        tags: [],
      },
    ]);

    const result = await runPull(client as any);

    expect(result).toEqual(['signals', 'market-data']);

    const signalsPath = path.join(tmpDir, '.zooid', 'channels', 'signals.json');
    const signals = JSON.parse(fs.readFileSync(signalsPath, 'utf-8'));
    expect(signals.visibility).toBe('private');
    expect(signals.name).toBe('Trading Signals');
    expect(signals.description).toBe('Processed signals');
    expect(signals.config).toEqual({ strict_types: true });

    const marketPath = path.join(
      tmpDir,
      '.zooid',
      'channels',
      'market-data.json',
    );
    const market = JSON.parse(fs.readFileSync(marketPath, 'utf-8'));
    expect(market.visibility).toBe('public');
    expect(market.name).toBeUndefined(); // name === id, omitted
    expect(market.description).toBeUndefined(); // null, omitted
    expect(market.config).toBeUndefined(); // null, omitted
  });

  it('creates .zooid/channels/ directory if it does not exist', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      {
        id: 'test',
        name: 'Test',
        description: null,
        is_public: true,
        config: null,
        event_count: 0,
        last_event_at: null,
        tags: [],
      },
    ]);

    await runPull(client as any);

    expect(
      fs.existsSync(path.join(tmpDir, '.zooid', 'channels', 'test.json')),
    ).toBe(true);
  });

  it('pulls roles from server into .zooid/roles/', async () => {
    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([]);
    client.listRoles.mockResolvedValueOnce([
      { id: 'analyst', scopes: ['sub:market-data', 'pub:signals'] },
      { id: 'reviewer', name: 'Reviewer', scopes: ['sub:*'] },
    ]);

    await runPull(client as any);

    const analystPath = path.join(tmpDir, '.zooid', 'roles', 'analyst.json');
    const analyst = JSON.parse(fs.readFileSync(analystPath, 'utf-8'));
    expect(analyst.scopes).toEqual(['sub:market-data', 'pub:signals']);

    const reviewerPath = path.join(tmpDir, '.zooid', 'roles', 'reviewer.json');
    const reviewer = JSON.parse(fs.readFileSync(reviewerPath, 'utf-8'));
    expect(reviewer.name).toBe('Reviewer');
    expect(reviewer.scopes).toEqual(['sub:*']);
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
