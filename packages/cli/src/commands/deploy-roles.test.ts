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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-deploy-roles-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('deploy role sync (integration)', () => {
  it('end-to-end: loads roles from .zooid/, builds mapping, writes to wrangler.toml', () => {
    // Set up .zooid/roles/
    const rolesDir = path.join(tmpDir, '.zooid', 'roles');
    fs.mkdirSync(rolesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rolesDir, 'analyst.json'),
      JSON.stringify({
        name: 'Analyst',
        scopes: ['sub:market-data', 'pub:signals'],
      }),
    );
    fs.writeFileSync(
      path.join(rolesDir, 'executor.json'),
      JSON.stringify({
        name: 'Executor',
        scopes: ['sub:signals', 'pub:trades'],
      }),
    );

    // Set up wrangler.toml
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

    // Simulate what deploy does
    const roles = loadRoleDefs();
    expect(roles.size).toBe(2);

    const mapping = rolesToScopeMapping(roles);
    setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', mapping);

    // Verify wrangler.toml
    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).toContain('ZOOID_SCOPE_MAPPING');

    const parsed = JSON.parse(
      result.match(/ZOOID_SCOPE_MAPPING = '(.+)'/)?.[1] ?? '{}',
    );
    expect(parsed.analyst).toEqual(['sub:market-data', 'pub:signals']);
    expect(parsed.executor).toEqual(['sub:signals', 'pub:trades']);
  });

  it('loads channels from .zooid/channels/', () => {
    const channelsDir = path.join(tmpDir, '.zooid', 'channels');
    fs.mkdirSync(channelsDir, { recursive: true });
    fs.writeFileSync(
      path.join(channelsDir, 'signals.json'),
      JSON.stringify({ name: 'Signals', visibility: 'private' }),
    );

    const defs = loadChannelDefs();
    expect(defs.size).toBe(1);
    expect(defs.get('signals')!.visibility).toBe('private');
  });

  it('removes ZOOID_SCOPE_MAPPING when no roles defined', () => {
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
