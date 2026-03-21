import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveRoleScopes } from './resolve-roles';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-resolve-test-')),
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

describe('resolveRoleScopes', () => {
  it('expands a single role to its scopes', () => {
    writeWorkforce({
      channels: {},
      roles: { analyst: { scopes: ['sub:market-data', 'pub:signals'] } },
    });

    const scopes = resolveRoleScopes(['analyst']);
    expect(scopes).toEqual(['sub:market-data', 'pub:signals']);
  });

  it('unions scopes from multiple roles', () => {
    writeWorkforce({
      channels: {},
      roles: {
        analyst: { scopes: ['sub:market-data', 'pub:signals'] },
        reviewer: { scopes: ['sub:*'] },
      },
    });

    const scopes = resolveRoleScopes(['analyst', 'reviewer']);
    expect(scopes).toContain('sub:market-data');
    expect(scopes).toContain('pub:signals');
    expect(scopes).toContain('sub:*');
  });

  it('deduplicates scopes across roles', () => {
    writeWorkforce({
      channels: {},
      roles: {
        'role-a': { scopes: ['sub:data', 'pub:signals'] },
        'role-b': { scopes: ['sub:data', 'pub:alerts'] },
      },
    });

    const scopes = resolveRoleScopes(['role-a', 'role-b']);
    const dataCount = scopes.filter((s) => s === 'sub:data').length;
    expect(dataCount).toBe(1);
  });

  it('throws for unknown role', () => {
    writeWorkforce({ channels: {}, roles: {} });

    expect(() => resolveRoleScopes(['nonexistent'])).toThrow(
      'Role "nonexistent" not found',
    );
  });
});
