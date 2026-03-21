import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../lib/zoon', () => ({
  createCredential: vi.fn(),
  listCredentials: vi.fn(),
  rotateCredential: vi.fn(),
  revokeCredential: vi.fn(),
  isZoonHosted: vi.fn().mockReturnValue(true),
  extractSubdomain: vi.fn().mockReturnValue('beno'),
}));

vi.mock('../lib/workforce', () => ({
  loadWorkforce: vi.fn().mockReturnValue({
    channels: {},
    roles: {
      analyst: { scopes: ['sub:market-data', 'pub:signals'] },
    },
  }),
  compileAgents: vi.fn().mockReturnValue(new Map()),
}));

import {
  runCredentialsCreate,
  runCredentialsList,
  runCredentialsRotate,
  runCredentialsRevoke,
} from './credentials';
import {
  createCredential,
  listCredentials,
  rotateCredential,
  revokeCredential,
} from '../lib/zoon';

const mockCreate = vi.mocked(createCredential);
const mockList = vi.mocked(listCredentials);
const mockRotate = vi.mocked(rotateCredential);
const mockRevoke = vi.mocked(revokeCredential);

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-cred-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.ZOOID_CONFIG_DIR = path.join(tmpDir, '.zooid-config');
  fs.mkdirSync(path.join(tmpDir, '.zooid-config'), { recursive: true });
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
  // Workforce file for auto-resolve
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
  fs.mkdirSync(path.join(tmpDir, '.zooid'), { recursive: true });
});

afterEach(() => {
  process.chdir(origCwd);
  delete process.env.ZOOID_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('runCredentialsCreate', () => {
  it('creates credential and outputs .env to stdout', async () => {
    mockCreate.mockResolvedValueOnce({
      name: 'analyst',
      client_id: 'sa_abc',
      client_secret: 'secret_xyz',
    });

    const output = await runCredentialsCreate('analyst', {});

    expect(output).toContain('ZOOID_SERVER=https://beno.zoon.eco');
    expect(output).toContain('ZOOID_CLIENT_ID=sa_abc');
    expect(output).toContain('ZOOID_CLIENT_SECRET=secret_xyz');
  });

  it('auto-resolves role from workforce file when --role omitted', async () => {
    mockCreate.mockResolvedValueOnce({
      name: 'analyst',
      client_id: 'sa_abc',
      client_secret: 'secret_xyz',
    });

    await runCredentialsCreate('analyst', {});

    // Should have called createCredential with role names from workforce
    expect(mockCreate).toHaveBeenCalledWith(
      'https://beno.zoon.eco',
      'plat_test',
      'analyst',
      ['analyst'],
    );
  });

  it('uses explicit --role when provided', async () => {
    mockCreate.mockResolvedValueOnce({
      name: 'my-bot',
      client_id: 'sa_bot',
      client_secret: 'secret_bot',
    });

    await runCredentialsCreate('my-bot', { role: ['analyst', 'reviewer'] });

    expect(mockCreate).toHaveBeenCalledWith(
      'https://beno.zoon.eco',
      'plat_test',
      'my-bot',
      ['analyst', 'reviewer'],
    );
  });
});

describe('runCredentialsList', () => {
  it('returns formatted credential list', async () => {
    mockList.mockResolvedValueOnce([
      {
        name: 'bot-1',
        client_id: 'sa_1',
        roles: [{ id: 'role_1', name: 'analyst' }],
        created_at: '2026-03-20',
      },
    ]);

    const result = await runCredentialsList();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('bot-1');
  });
});

describe('runCredentialsRotate', () => {
  it('rotates by name and outputs new .env', async () => {
    mockList.mockResolvedValueOnce([
      {
        name: 'bot-1',
        client_id: 'sa_1',
        roles: [{ id: 'r1', name: 'analyst' }],
        created_at: '2026-03-20',
      },
    ]);
    mockRotate.mockResolvedValueOnce({
      client_id: 'sa_1',
      client_secret: 'new_secret',
    });

    const output = await runCredentialsRotate('bot-1');
    expect(output).toContain('ZOOID_CLIENT_SECRET=new_secret');
    expect(mockRotate).toHaveBeenCalledWith(
      'https://beno.zoon.eco',
      'plat_test',
      'sa_1',
    );
  });
});

describe('runCredentialsRevoke', () => {
  it('revokes by name', async () => {
    mockList.mockResolvedValueOnce([
      {
        name: 'bot-1',
        client_id: 'sa_1',
        roles: [{ id: 'r1', name: 'analyst' }],
        created_at: '2026-03-20',
      },
    ]);
    mockRevoke.mockResolvedValueOnce(undefined);
    await runCredentialsRevoke('bot-1');
    expect(mockRevoke).toHaveBeenCalledWith(
      'https://beno.zoon.eco',
      'plat_test',
      'sa_1',
    );
  });
});
