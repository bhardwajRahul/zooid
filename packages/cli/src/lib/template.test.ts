import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fetchTemplate } from './template';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-template-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('fetchTemplate', () => {
  it('calls fetch with correct tarball URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(
      fetchTemplate('https://github.com/zooid-ai/trading-desk', tmpDir, {
        fetch: mockFetch as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toThrow('Failed to fetch template from GitHub: HTTP 404');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/zooid-ai/trading-desk/tarball/main',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'zooid-cli',
        }),
      }),
    );
  });

  it('throws for non-GitHub URLs', async () => {
    await expect(
      fetchTemplate('https://gitlab.com/foo/bar', tmpDir),
    ).rejects.toThrow('Only GitHub URLs are supported');
  });

  it('throws when template has no .zooid/ content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    await expect(
      fetchTemplate('https://github.com/zooid-ai/empty-repo', tmpDir, {
        fetch: mockFetch as unknown as typeof globalThis.fetch,
      }),
    ).rejects.toThrow("doesn't look like a Zooid template");
  });
});
