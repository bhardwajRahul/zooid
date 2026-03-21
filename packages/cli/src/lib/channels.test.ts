import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadChannelDefs } from './channels';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-channels-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeWorkforce(data: Record<string, unknown>) {
  const dir = path.join(tmpDir, '.zooid');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'workforce.json'), JSON.stringify(data));
}

describe('loadChannelDefs (from .zooid/workforce.json)', () => {
  it('returns empty map when workforce.json does not exist', () => {
    const defs = loadChannelDefs();
    expect(defs.size).toBe(0);
  });

  it('loads channel definitions from workforce.json', () => {
    writeWorkforce({
      channels: {
        signals: {
          name: 'Trading Signals',
          description: 'Processed signals',
          visibility: 'private',
          config: { strict_types: true },
        },
        'market-data': {
          name: 'Market Data',
          visibility: 'public',
        },
      },
      roles: {},
    });

    const defs = loadChannelDefs();
    expect(defs.size).toBe(2);

    const signals = defs.get('signals')!;
    expect(signals.name).toBe('Trading Signals');
    expect(signals.visibility).toBe('private');
  });

  it('returns empty map when workforce.json has no channels', () => {
    writeWorkforce({ roles: {} });

    const defs = loadChannelDefs();
    expect(defs.size).toBe(0);
  });

  it('finds workforce.json from a subdirectory', () => {
    writeWorkforce({
      channels: { signals: { visibility: 'public' } },
      roles: {},
    });
    const sub = path.join(tmpDir, 'src');
    fs.mkdirSync(sub, { recursive: true });
    process.chdir(sub);

    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
  });
});
