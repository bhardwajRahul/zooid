import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseWranglerToml, removeServerFromState } from './destroy';

describe('destroy helpers', () => {
  describe('parseWranglerToml', () => {
    it('extracts worker name and database info', () => {
      const toml = `
name = "zooid-my-server"
main = "src/index.ts"

[[d1_databases]]
binding = "DB"
database_name = "zooid-db-my-server"
database_id = "abc-123-def"
`;
      const result = parseWranglerToml(toml);
      expect(result.workerName).toBe('zooid-my-server');
      expect(result.dbName).toBe('zooid-db-my-server');
      expect(result.databaseId).toBe('abc-123-def');
    });

    it('returns nulls for missing fields', () => {
      const result = parseWranglerToml('name = "test"');
      expect(result.workerName).toBe('test');
      expect(result.dbName).toBeNull();
      expect(result.databaseId).toBeNull();
    });

    it('returns all nulls for empty content', () => {
      const result = parseWranglerToml('');
      expect(result.workerName).toBeNull();
      expect(result.dbName).toBeNull();
      expect(result.databaseId).toBeNull();
    });
  });

  describe('removeServerFromState', () => {
    let tmpDir: string;
    let originalEnv: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-test-'));
      originalEnv = process.env.ZOOID_CONFIG_DIR;
      process.env.ZOOID_CONFIG_DIR = tmpDir;
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ZOOID_CONFIG_DIR = originalEnv;
      } else {
        delete process.env.ZOOID_CONFIG_DIR;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('removes server entry and resets current if it matches', () => {
      const statePath = path.join(tmpDir, 'state.json');
      fs.writeFileSync(
        statePath,
        JSON.stringify({
          current: 'https://zooid-my-server.workers.dev',
          servers: {
            'https://zooid-my-server.workers.dev': {
              admin_token: 'tok_123',
            },
            'https://other.workers.dev': {
              admin_token: 'tok_456',
            },
          },
        }),
      );

      removeServerFromState('https://zooid-my-server.workers.dev');

      const updated = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      expect(
        updated.servers['https://zooid-my-server.workers.dev'],
      ).toBeUndefined();
      expect(updated.servers['https://other.workers.dev']).toBeDefined();
      expect(updated.current).toBeUndefined();
    });

    it('preserves current if removing a different server', () => {
      const statePath = path.join(tmpDir, 'state.json');
      fs.writeFileSync(
        statePath,
        JSON.stringify({
          current: 'https://other.workers.dev',
          servers: {
            'https://zooid-my-server.workers.dev': {
              admin_token: 'tok_123',
            },
            'https://other.workers.dev': {
              admin_token: 'tok_456',
            },
          },
        }),
      );

      removeServerFromState('https://zooid-my-server.workers.dev');

      const updated = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      expect(updated.current).toBe('https://other.workers.dev');
    });

    it('does nothing if state file does not exist', () => {
      // No state file created — should not throw
      removeServerFromState('https://nonexistent.workers.dev');
    });
  });
});
