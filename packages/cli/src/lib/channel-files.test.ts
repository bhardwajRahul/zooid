import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  writeChannelFile,
  readChannelFile,
  deleteChannelFile,
  listChannelFiles,
} from './channel-files';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-chfiles-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeChannelFile', () => {
  it('creates .zooid/channels/<id>.json', () => {
    writeChannelFile('signals', {
      name: 'Trading Signals',
      visibility: 'private',
    });

    const filePath = path.join(tmpDir, '.zooid', 'channels', 'signals.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.name).toBe('Trading Signals');
    expect(content.visibility).toBe('private');
  });

  it('creates .zooid/channels/ directory if missing', () => {
    writeChannelFile('test', { visibility: 'public' });
    expect(fs.existsSync(path.join(tmpDir, '.zooid', 'channels'))).toBe(true);
  });

  it('overwrites existing file', () => {
    writeChannelFile('signals', { name: 'Old', visibility: 'public' });
    writeChannelFile('signals', { name: 'New', visibility: 'private' });

    const content = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, '.zooid', 'channels', 'signals.json'),
        'utf-8',
      ),
    );
    expect(content.name).toBe('New');
    expect(content.visibility).toBe('private');
  });
});

describe('readChannelFile', () => {
  it('reads an existing channel file', () => {
    writeChannelFile('signals', {
      name: 'Signals',
      description: 'Test',
      visibility: 'private',
      config: { strict_types: true },
    });

    const def = readChannelFile('signals');
    expect(def).not.toBeNull();
    expect(def!.name).toBe('Signals');
    expect(def!.visibility).toBe('private');
  });

  it('returns null when file does not exist', () => {
    expect(readChannelFile('nonexistent')).toBeNull();
  });
});

describe('deleteChannelFile', () => {
  it('deletes .zooid/channels/<id>.json', () => {
    writeChannelFile('signals', { visibility: 'public' });
    deleteChannelFile('signals');

    expect(
      fs.existsSync(path.join(tmpDir, '.zooid', 'channels', 'signals.json')),
    ).toBe(false);
  });

  it('throws when file does not exist', () => {
    expect(() => deleteChannelFile('nonexistent')).toThrow(
      'Channel "nonexistent" not found',
    );
  });
});

describe('listChannelFiles', () => {
  it('lists all channel IDs', () => {
    writeChannelFile('signals', { visibility: 'private' });
    writeChannelFile('market-data', { visibility: 'public' });

    const ids = listChannelFiles();
    expect(ids.sort()).toEqual(['market-data', 'signals']);
  });

  it('returns empty array when no channels', () => {
    expect(listChannelFiles()).toEqual([]);
  });
});
