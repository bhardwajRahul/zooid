import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadRoleDefs, rolesToScopeMapping } from '../lib/roles';
import { loadChannelDefs } from '../lib/channels';
import { setWranglerVar } from '../lib/wrangler-vars';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-deploy-roles-')),
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

describe('deploy role sync (integration)', () => {
  it('end-to-end: loads roles from workforce.json, builds mapping, writes to wrangler.toml', () => {
    writeWorkforce({
      channels: {},
      roles: {
        analyst: {
          name: 'Analyst',
          scopes: ['sub:market-data', 'pub:signals'],
        },
        executor: {
          name: 'Executor',
          scopes: ['sub:signals', 'pub:trades'],
        },
      },
    });

    const tomlPath = path.join(tmpDir, 'wrangler.toml');
    fs.writeFileSync(
      tomlPath,
      [
        'name = "zooid-test"',
        '',
        '[vars]',
        'ZOOID_SERVER_ID = "test"',
        '',
      ].join('\n'),
    );

    const roles = loadRoleDefs();
    expect(roles.size).toBe(2);

    const mapping = rolesToScopeMapping(roles);
    setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', mapping);

    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).toContain('ZOOID_SCOPE_MAPPING');

    const parsed = JSON.parse(
      result.match(/ZOOID_SCOPE_MAPPING = '(.+)'/)?.[1] ?? '{}',
    );
    expect(parsed.analyst).toEqual(['sub:market-data', 'pub:signals']);
    expect(parsed.executor).toEqual(['sub:signals', 'pub:trades']);
  });

  it('loads channels from workforce.json', () => {
    writeWorkforce({
      channels: { signals: { name: 'Signals', visibility: 'private' } },
      roles: {},
    });

    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
    expect(defs.get('signals')!.visibility).toBe('private');
  });

  it('maps "public" workforce key to "authenticated" slug', () => {
    writeWorkforce({
      channels: {},
      roles: {
        public: { name: 'Public', scopes: ['sub:support', 'pub:support'] },
        member: { name: 'Member', scopes: ['pub:*', 'sub:*'] },
      },
    });

    const roles = loadRoleDefs();
    // Simulate the deploy mapping logic (public → authenticated, filter owner)
    const mapped = Array.from(roles.entries())
      .filter(([id]) => id !== 'owner')
      .map(([id, def]) => ({
        slug: id === 'public' ? 'authenticated' : id,
        scopes: def.scopes,
      }));

    const authRole = mapped.find((r) => r.slug === 'authenticated');
    expect(authRole).toBeDefined();
    expect(authRole!.scopes).toEqual(['sub:support', 'pub:support']);
    expect(mapped.find((r) => r.slug === 'public')).toBeUndefined();
  });

  it('removes ZOOID_SCOPE_MAPPING when no roles defined', () => {
    writeWorkforce({ channels: {}, roles: {} });

    const tomlPath = path.join(tmpDir, 'wrangler.toml');
    fs.writeFileSync(
      tomlPath,
      [
        '[vars]',
        'ZOOID_SERVER_ID = "test"',
        'ZOOID_SCOPE_MAPPING = \'{"old":["sub:*"]}\'',
        '',
      ].join('\n'),
    );

    const roles = loadRoleDefs();
    expect(roles.size).toBe(0);

    const mapping = rolesToScopeMapping(roles);
    if (mapping === '{}') {
      setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', null);
    }

    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).not.toContain('ZOOID_SCOPE_MAPPING');
  });
});
