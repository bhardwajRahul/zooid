import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadChannelDefs } from './channels';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-channels-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeChannelDef(id: string, def: Record<string, unknown>) {
  const dir = path.join(tmpDir, '.zooid', 'channels');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(def));
}

describe('loadChannelDefs (from .zooid/channels/)', () => {
  it('returns empty map when .zooid/channels/ does not exist', () => {
    const defs = loadChannelDefs();
    expect(defs.size).toBe(0);
  });

  it('loads channel definitions from .zooid/channels/*.json', () => {
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
  });

  it('ignores non-JSON files', () => {
    const dir = path.join(tmpDir, '.zooid', 'channels');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    writeChannelDef('signals', { visibility: 'public' });

    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
  });

  it('uses filename without .json as channel ID', () => {
    writeChannelDef('my-channel', { visibility: 'public' });
    const defs = loadChannelDefs();
    expect(defs.has('my-channel')).toBe(true);
  });

  it('finds .zooid/channels/ from a subdirectory', () => {
    writeChannelDef('signals', { visibility: 'public' });
    const sub = path.join(tmpDir, 'src');
    fs.mkdirSync(sub, { recursive: true });
    process.chdir(sub);

    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
  });
});
