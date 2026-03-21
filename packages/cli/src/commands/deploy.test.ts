import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChannelDefs } from '../lib/channels';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-deploy-test-')),
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

describe('loadChannelDefs()', () => {
  it('returns empty map when workforce.json does not exist', () => {
    const defs = loadChannelDefs();
    expect(defs.size).toBe(0);
  });

  it('returns empty map when workforce.json has no channels', () => {
    writeWorkforce({ channels: {}, roles: {} });
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
    expect(signals.config).toEqual({ strict_types: true });

    const market = defs.get('market-data')!;
    expect(market.name).toBe('Market Data');
    expect(market.visibility).toBe('public');
  });

  it('uses workforce.json channel keys as IDs', () => {
    writeWorkforce({
      channels: { 'my-channel': { visibility: 'public' } },
      roles: {},
    });
    const defs = loadChannelDefs();
    expect(defs.has('my-channel')).toBe(true);
  });

  it('only loads channels, ignoring roles', () => {
    writeWorkforce({
      channels: { signals: { visibility: 'public' } },
      roles: { admin: { scopes: ['admin'] } },
    });
    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
  });
});
