import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setWranglerVar } from './wrangler-vars';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-wrangler-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('setWranglerVar', () => {
  it('adds var to existing [vars] section', () => {
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

    setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', '{"analyst":["sub:*"]}');

    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).toContain('ZOOID_SCOPE_MAPPING = \'{"analyst":["sub:*"]}\'');
    expect(result).toContain('ZOOID_SERVER_ID = "test"');
  });

  it('updates existing var value', () => {
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

    setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', '{"new":["pub:*"]}');

    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).toContain('ZOOID_SCOPE_MAPPING = \'{"new":["pub:*"]}\'');
    expect(result).not.toContain('old');
  });

  it('creates [vars] section if missing', () => {
    const tomlPath = path.join(tmpDir, 'wrangler.toml');
    fs.writeFileSync(tomlPath, 'name = "zooid-test"\n');

    setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', '{"analyst":["sub:*"]}');

    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).toContain('[vars]');
    expect(result).toContain('ZOOID_SCOPE_MAPPING = \'{"analyst":["sub:*"]}\'');
  });

  it('removes var when value is null', () => {
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

    setWranglerVar(tomlPath, 'ZOOID_SCOPE_MAPPING', null);

    const result = fs.readFileSync(tomlPath, 'utf-8');
    expect(result).not.toContain('ZOOID_SCOPE_MAPPING');
    expect(result).toContain('ZOOID_SERVER_ID = "test"');
  });
});
