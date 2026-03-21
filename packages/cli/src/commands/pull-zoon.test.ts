import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../lib/zoon', () => ({
  isZoonHosted: vi.fn(),
  listRolesFromZoon: vi.fn(),
}));

vi.mock('@zooid/sdk', () => ({
  ZooidClient: vi.fn().mockImplementation(() => ({
    listChannels: vi
      .fn()
      .mockResolvedValue([
        { id: 'signals', name: 'Signals', is_public: false },
      ]),
    listRoles: vi.fn().mockResolvedValue([{ id: 'viewer', scopes: ['sub:*'] }]),
  })),
}));

import { isZoonHosted, listRolesFromZoon } from '../lib/zoon';
const mockIsZoon = vi.mocked(isZoonHosted);
const mockListRolesZoon = vi.mocked(listRolesFromZoon);

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-pull-zoon-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.ZOOID_CONFIG_DIR = path.join(tmpDir, '.zooid-config');
  fs.mkdirSync(path.join(tmpDir, '.zooid-config'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
  fs.mkdirSync(path.join(tmpDir, '.zooid'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.zooid-config', 'state.json'),
    JSON.stringify({
      current: 'https://beno.zoon.eco',
      servers: {
        'https://beno.zoon.eco': {
          admin_token: 'jwt_test',
          platform_token: 'plat_test',
          auth_method: 'oidc',
        },
      },
    }),
  );
});

afterEach(() => {
  process.chdir(origCwd);
  delete process.env.ZOOID_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('pull with Zoon-hosted server', () => {
  it('fetches roles from platform API instead of tenant', async () => {
    mockIsZoon.mockReturnValue(true);
    mockListRolesZoon.mockResolvedValueOnce([
      { id: 'role_1', name: 'analyst', scopes: ['pub:signals'] },
      { id: 'role_2', name: 'reviewer', scopes: ['sub:*'] },
    ]);

    // Import pull after mocks are set up
    const { runPull } = await import('./pull');
    await runPull();

    expect(mockListRolesZoon).toHaveBeenCalled();
  });

  it('fetches roles from tenant for self-hosted', async () => {
    mockIsZoon.mockReturnValue(false);

    const { runPull } = await import('./pull');
    await runPull();

    // Should NOT call platform API
    expect(mockListRolesZoon).not.toHaveBeenCalled();
  });
});
