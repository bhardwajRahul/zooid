import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { findProjectRoot, getZooidDir } from './project';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-project-test-')),
  );
  origCwd = process.cwd();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('findProjectRoot', () => {
  it('finds root when zooid.json exists in cwd', () => {
    fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
    process.chdir(tmpDir);

    expect(findProjectRoot()).toBe(tmpDir);
  });

  it('finds root when .zooid/ exists in cwd', () => {
    fs.mkdirSync(path.join(tmpDir, '.zooid'));
    process.chdir(tmpDir);

    expect(findProjectRoot()).toBe(tmpDir);
  });

  it('finds root from a subdirectory', () => {
    fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
    const sub = path.join(tmpDir, 'src', 'agents');
    fs.mkdirSync(sub, { recursive: true });
    process.chdir(sub);

    expect(findProjectRoot()).toBe(tmpDir);
  });

  it('returns null when no project root found', () => {
    process.chdir(tmpDir);

    // Should return null, not throw
    expect(findProjectRoot()).toBeNull();
  });
});

describe('getZooidDir', () => {
  it('returns .zooid/ path relative to project root', () => {
    fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '.zooid'));
    process.chdir(tmpDir);

    expect(getZooidDir()).toBe(path.join(tmpDir, '.zooid'));
  });

  it('throws when no project root found', () => {
    process.chdir(tmpDir);

    expect(() => getZooidDir()).toThrow('Not a Zooid project');
  });
});
