import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadRoleDefs, rolesToScopeMapping, type RoleDef } from './roles';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-roles-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  // Create project marker
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeRoleDef(id: string, def: Record<string, unknown>) {
  const dir = path.join(tmpDir, '.zooid', 'roles');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(def));
}

describe('loadRoleDefs', () => {
  it('returns empty map when .zooid/roles/ does not exist', () => {
    const defs = loadRoleDefs();
    expect(defs.size).toBe(0);
  });

  it('loads role definitions from .zooid/roles/*.json', () => {
    writeRoleDef('analyst', {
      name: 'Analyst',
      description: 'Reads market data',
      scopes: ['sub:market-data', 'pub:signals'],
    });
    writeRoleDef('reviewer', {
      name: 'Reviewer',
      scopes: ['sub:*'],
    });

    const defs = loadRoleDefs();
    expect(defs.size).toBe(2);
    expect(defs.get('analyst')!.scopes).toEqual([
      'sub:market-data',
      'pub:signals',
    ]);
    expect(defs.get('reviewer')!.scopes).toEqual(['sub:*']);
  });

  it('ignores non-JSON files', () => {
    const dir = path.join(tmpDir, '.zooid', 'roles');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Roles');
    writeRoleDef('analyst', { name: 'Analyst', scopes: ['sub:*'] });

    const defs = loadRoleDefs();
    expect(defs.size).toBe(1);
  });

  it('uses filename (without .json) as role ID', () => {
    writeRoleDef('market-feed-publisher', { scopes: ['pub:market-data'] });

    const defs = loadRoleDefs();
    expect(defs.has('market-feed-publisher')).toBe(true);
  });

  it('finds .zooid/roles/ from a subdirectory', () => {
    writeRoleDef('analyst', { scopes: ['sub:*'] });
    const sub = path.join(tmpDir, 'src', 'agents');
    fs.mkdirSync(sub, { recursive: true });
    process.chdir(sub);

    const defs = loadRoleDefs();
    expect(defs.size).toBe(1);
  });
});

describe('rolesToScopeMapping', () => {
  it('converts role defs to ZOOID_SCOPE_MAPPING JSON', () => {
    const roles = new Map<string, RoleDef>([
      ['analyst', { scopes: ['sub:market-data', 'pub:signals'] }],
      ['reviewer', { scopes: ['sub:*'] }],
    ]);

    const json = rolesToScopeMapping(roles);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      analyst: ['sub:market-data', 'pub:signals'],
      reviewer: ['sub:*'],
    });
  });

  it('returns empty object JSON for empty map', () => {
    const json = rolesToScopeMapping(new Map());
    expect(json).toBe('{}');
  });
});
