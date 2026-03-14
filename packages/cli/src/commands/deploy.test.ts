import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChannelDefs } from './deploy';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-deploy-test-'));
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

describe('loadChannelDefs()', () => {
  it('returns empty map when channels/ does not exist', () => {
    const defs = loadChannelDefs();
    expect(defs.size).toBe(0);
  });

  it('returns empty map when channels/ has no JSON files', () => {
    fs.mkdirSync(path.join(tmpDir, 'channels'));
    fs.writeFileSync(path.join(tmpDir, 'channels', '.gitkeep'), '');
    const defs = loadChannelDefs();
    expect(defs.size).toBe(0);
  });

  it('loads channel definitions from JSON files', () => {
    writeChannelDef('signals', {
      name: 'Trading Signals',
      description: 'Processed signals',
      visibility: 'private',
      config: { strict_types: true },
    });
    writeChannelDef('market-data', {
      name: 'Market Data',
      visibility: 'public',
    });

    const defs = loadChannelDefs();
    expect(defs.size).toBe(2);

    const signals = defs.get('signals')!;
    expect(signals.name).toBe('Trading Signals');
    expect(signals.visibility).toBe('private');
    expect(signals.config).toEqual({ strict_types: true });

    const market = defs.get('market-data')!;
    expect(market.name).toBe('Market Data');
    expect(market.visibility).toBe('public');
  });

  it('uses filename without .json as channel ID', () => {
    writeChannelDef('my-channel', { visibility: 'public' });
    const defs = loadChannelDefs();
    expect(defs.has('my-channel')).toBe(true);
  });

  it('ignores non-JSON files', () => {
    fs.mkdirSync(path.join(tmpDir, 'channels'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'channels', 'README.md'), '# Channels');
    writeChannelDef('signals', { visibility: 'public' });
    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
  });
});
