import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  writeRoleFile,
  readRoleFile,
  deleteRoleFile,
  listRoleFiles,
} from './role-files';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-rolefiles-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeRoleFile', () => {
  it('creates .zooid/roles/<id>.json', () => {
    writeRoleFile('analyst', {
      name: 'Analyst',
      scopes: ['sub:market-data', 'pub:signals'],
    });

    const filePath = path.join(tmpDir, '.zooid', 'roles', 'analyst.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.name).toBe('Analyst');
    expect(content.scopes).toEqual(['sub:market-data', 'pub:signals']);
  });

  it('creates .zooid/roles/ directory if missing', () => {
    writeRoleFile('test', { scopes: ['sub:*'] });
    expect(fs.existsSync(path.join(tmpDir, '.zooid', 'roles'))).toBe(true);
  });

  it('overwrites existing file', () => {
    writeRoleFile('analyst', { scopes: ['sub:*'] });
    writeRoleFile('analyst', { name: 'Updated', scopes: ['pub:*'] });

    const content = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, '.zooid', 'roles', 'analyst.json'),
        'utf-8',
      ),
    );
    expect(content.name).toBe('Updated');
    expect(content.scopes).toEqual(['pub:*']);
  });
});

describe('readRoleFile', () => {
  it('reads an existing role file', () => {
    writeRoleFile('analyst', {
      name: 'Analyst',
      description: 'Data reader',
      scopes: ['sub:market-data'],
    });

    const def = readRoleFile('analyst');
    expect(def).not.toBeNull();
    expect(def!.name).toBe('Analyst');
    expect(def!.scopes).toEqual(['sub:market-data']);
  });

  it('returns null when file does not exist', () => {
    expect(readRoleFile('nonexistent')).toBeNull();
  });
});

describe('deleteRoleFile', () => {
  it('deletes .zooid/roles/<id>.json', () => {
    writeRoleFile('analyst', { scopes: ['sub:*'] });
    deleteRoleFile('analyst');

    expect(
      fs.existsSync(path.join(tmpDir, '.zooid', 'roles', 'analyst.json')),
    ).toBe(false);
  });

  it('throws when file does not exist', () => {
    expect(() => deleteRoleFile('nonexistent')).toThrow(
      'Role "nonexistent" not found',
    );
  });
});

describe('listRoleFiles', () => {
  it('lists all role IDs', () => {
    writeRoleFile('analyst', { scopes: ['sub:*'] });
    writeRoleFile('executor', { scopes: ['pub:*'] });

    const ids = listRoleFiles();
    expect(ids.sort()).toEqual(['analyst', 'executor']);
  });

  it('returns empty array when no roles', () => {
    expect(listRoleFiles()).toEqual([]);
  });
});
