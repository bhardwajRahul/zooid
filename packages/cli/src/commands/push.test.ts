import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPush } from './push';

let tmpDir: string;
let origCwd: string;

function makeMockClient() {
  return {
    createChannel: vi.fn().mockResolvedValue({ id: 'x', token: 'tok' }),
    listChannels: vi.fn().mockResolvedValue([]),
    updateChannel: vi.fn().mockResolvedValue({}),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-push-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeChannelDef(id: string, def: Record<string, unknown>) {
  const dir = path.join(tmpDir, 'channels');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(def));
}

describe('runPush()', () => {
  it('does nothing when channels/ is empty', async () => {
    const client = makeMockClient();
    await runPush(client as any);
    expect(client.listChannels).not.toHaveBeenCalled();
  });

  it('creates channels that exist locally but not on server', async () => {
    writeChannelDef('signals', {
      name: 'Signals',
      description: 'Test',
      visibility: 'private',
      config: { strict_types: true },
    });
    writeChannelDef('market-data', {
      name: 'Market Data',
      visibility: 'public',
    });

    const client = makeMockClient();
    await runPush(client as any);

    expect(client.createChannel).toHaveBeenCalledTimes(2);
    expect(client.createChannel).toHaveBeenCalledWith({
      id: 'signals',
      name: 'Signals',
      description: 'Test',
      is_public: false,
      config: { strict_types: true },
    });
    expect(client.createChannel).toHaveBeenCalledWith({
      id: 'market-data',
      name: 'Market Data',
      description: undefined,
      is_public: true,
      config: undefined,
    });
  });

  it('updates channels that exist in both local and server', async () => {
    writeChannelDef('signals', {
      name: 'Updated Signals',
      description: 'New desc',
      visibility: 'public',
    });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'signals', name: 'Signals', is_public: false },
    ]);

    await runPush(client as any);

    expect(client.createChannel).not.toHaveBeenCalled();
    expect(client.updateChannel).toHaveBeenCalledWith('signals', {
      name: 'Updated Signals',
      description: 'New desc',
      is_public: true,
      config: undefined,
    });
  });

  it('creates new and updates existing in the same run', async () => {
    writeChannelDef('existing', { name: 'Existing', visibility: 'public' });
    writeChannelDef('new-one', { name: 'New', visibility: 'private' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'existing', name: 'Old Name', is_public: true },
    ]);

    await runPush(client as any);

    expect(client.createChannel).toHaveBeenCalledTimes(1);
    expect(client.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-one' }),
    );
    expect(client.updateChannel).toHaveBeenCalledTimes(1);
    expect(client.updateChannel).toHaveBeenCalledWith(
      'existing',
      expect.objectContaining({ name: 'Existing' }),
    );
  });

  it('does not delete orphaned channels when user declines', async () => {
    writeChannelDef('kept', { name: 'Kept', visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'kept', name: 'Kept', is_public: true },
      { id: 'orphan', name: 'Orphan', is_public: false },
    ]);

    await runPush(client as any, {
      confirmDelete: async () => false,
    });

    expect(client.deleteChannel).not.toHaveBeenCalled();
  });

  it('deletes orphaned channels when user confirms', async () => {
    writeChannelDef('kept', { name: 'Kept', visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'kept', name: 'Kept', is_public: true },
      { id: 'orphan-1', name: 'Orphan 1', is_public: false },
      { id: 'orphan-2', name: 'Orphan 2', is_public: true },
    ]);

    await runPush(client as any, {
      confirmDelete: async () => true,
    });

    expect(client.deleteChannel).toHaveBeenCalledTimes(2);
    expect(client.deleteChannel).toHaveBeenCalledWith('orphan-1');
    expect(client.deleteChannel).toHaveBeenCalledWith('orphan-2');
  });

  it('passes orphaned channel info to confirmDelete callback', async () => {
    writeChannelDef('kept', { name: 'Kept', visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'kept', name: 'Kept', is_public: true },
      { id: 'orphan', name: 'Orphan Chan', is_public: false },
    ]);

    const confirmDelete = vi.fn().mockResolvedValue(false);
    await runPush(client as any, { confirmDelete });

    expect(confirmDelete).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'orphan' }),
    ]);
  });

  it('uses channel ID as name when name is not specified', async () => {
    writeChannelDef('my-channel', { visibility: 'public' });

    const client = makeMockClient();
    await runPush(client as any);

    expect(client.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'my-channel',
        name: 'my-channel',
      }),
    );
  });

  it('does not prompt when there are no orphaned channels', async () => {
    writeChannelDef('signals', { visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'signals', name: 'Signals', is_public: true },
    ]);

    const confirmDelete = vi.fn();
    await runPush(client as any, { confirmDelete });

    expect(confirmDelete).not.toHaveBeenCalled();
  });
});
