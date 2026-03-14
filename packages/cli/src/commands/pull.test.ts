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
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-pull-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeChannelDef(id: string, def: Record<string, unknown>) {
  const dir = path.join(tmpDir, 'channels');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(def));
}

describe('runPull()', () => {
  it('returns empty array when server has no channels', async () => {
    const client = makeMockClient();
    const result = await runPull(client as any);
    expect(result).toEqual([]);
  });

  it('writes channel definitions to channels/ directory', async () => {
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

    const signalsPath = path.join(tmpDir, 'channels', 'signals.json');
    const signals = JSON.parse(fs.readFileSync(signalsPath, 'utf-8'));
    expect(signals.visibility).toBe('private');
    expect(signals.name).toBe('Trading Signals');
    expect(signals.description).toBe('Processed signals');
    expect(signals.config).toEqual({ strict_types: true });

    const marketPath = path.join(tmpDir, 'channels', 'market-data.json');
    const market = JSON.parse(fs.readFileSync(marketPath, 'utf-8'));
    expect(market.visibility).toBe('public');
    expect(market.name).toBeUndefined(); // name === id, omitted
    expect(market.description).toBeUndefined(); // null, omitted
    expect(market.config).toBeUndefined(); // null, omitted
  });

  it('creates channels/ directory if it does not exist', async () => {
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

    expect(fs.existsSync(path.join(tmpDir, 'channels', 'test.json'))).toBe(
      true,
    );
  });

  it('overwrites existing channel files', async () => {
    writeChannelDef('signals', { name: 'Old', visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      {
        id: 'signals',
        name: 'New Name',
        description: null,
        is_public: false,
        config: null,
        event_count: 0,
        last_event_at: null,
        tags: [],
      },
    ]);

    await runPull(client as any);

    const signals = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'channels', 'signals.json'), 'utf-8'),
    );
    expect(signals.name).toBe('New Name');
    expect(signals.visibility).toBe('private');
  });
});
