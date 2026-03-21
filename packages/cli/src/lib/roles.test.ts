import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadRoleDefs, rolesToScopeMapping, type RoleDef } from './roles';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-roles-test-')),
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

describe('loadRoleDefs (from .zooid/workforce.json)', () => {
  it('returns empty map when workforce.json does not exist', () => {
    const defs = loadRoleDefs();
    expect(defs.size).toBe(0);
  });

  it('loads role definitions from workforce.json', () => {
    writeWorkforce({
      channels: {},
      roles: {
        analyst: {
          name: 'Analyst',
          description: 'Reads market data',
          scopes: ['sub:market-data', 'pub:signals'],
        },
        reviewer: {
          name: 'Reviewer',
          scopes: ['sub:*'],
        },
      },
    });

    const defs = loadRoleDefs();
    expect(defs.size).toBe(2);
    expect(defs.get('analyst')!.scopes).toEqual([
      'sub:market-data',
      'pub:signals',
    ]);
    expect(defs.get('reviewer')!.scopes).toEqual(['sub:*']);
  });

  it('includes agent-derived roles', () => {
    writeWorkforce({
      channels: { data: { visibility: 'public' } },
      agents: {
        writer: { publishes: ['data'] },
      },
    });

    const defs = loadRoleDefs();
    expect(defs.size).toBe(1);
    expect(defs.get('writer')!.scopes).toEqual(['pub:data']);
  });

  it('finds workforce.json from a subdirectory', () => {
    writeWorkforce({
      channels: {},
      roles: { analyst: { scopes: ['sub:*'] } },
    });
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
