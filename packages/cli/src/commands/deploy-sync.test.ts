import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { syncChannelsToServer } from '../lib/channel-sync';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-deploy-sync-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeChannelDef(id: string, def: Record<string, unknown>) {
  const dir = path.join(tmpDir, '.zooid', 'channels');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(def));
}

function makeMockClient() {
  return {
    listChannels: vi.fn().mockResolvedValue([]),
    createChannel: vi.fn().mockResolvedValue({ id: 'x', token: 'tok' }),
    updateChannel: vi.fn().mockResolvedValue({}),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
  };
}

describe('syncChannelsToServer', () => {
  it('creates channels that exist locally but not on server', async () => {
    writeChannelDef('signals', { name: 'Signals', visibility: 'private' });

    const client = makeMockClient();
    const result = await syncChannelsToServer(client as any);

    expect(client.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'signals' }),
    );
    expect(result.created).toBe(1);
  });

  it('updates channels that exist in both', async () => {
    writeChannelDef('signals', { name: 'Updated', visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'signals', name: 'Old', is_public: false },
    ]);

    const result = await syncChannelsToServer(client as any);

    expect(client.updateChannel).toHaveBeenCalledWith(
      'signals',
      expect.any(Object),
    );
    expect(result.updated).toBe(1);
  });

  it('reports orphaned channels for deletion', async () => {
    writeChannelDef('kept', { visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'kept', name: 'Kept', is_public: true },
      { id: 'orphan', name: 'Orphan', is_public: false },
    ]);

    const result = await syncChannelsToServer(client as any, {
      confirmDelete: async () => true,
    });

    expect(client.deleteChannel).toHaveBeenCalledWith('orphan');
    expect(result.deleted).toBe(1);
  });

  it('skips deletion when user declines', async () => {
    writeChannelDef('kept', { visibility: 'public' });

    const client = makeMockClient();
    client.listChannels.mockResolvedValueOnce([
      { id: 'kept', name: 'Kept', is_public: true },
      { id: 'orphan', name: 'Orphan', is_public: false },
    ]);

    const result = await syncChannelsToServer(client as any, {
      confirmDelete: async () => false,
    });

    expect(client.deleteChannel).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });

  it('does nothing when no local channels', async () => {
    const client = makeMockClient();
    const result = await syncChannelsToServer(client as any);

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
  });
});
