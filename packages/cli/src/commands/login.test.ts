import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../lib/device-auth', () => ({
  pollDeviceAuth: vi.fn(),
  exchangeToken: vi.fn(),
  fetchServers: vi.fn(),
}));

import { runLogin } from './login';
import {
  pollDeviceAuth,
  exchangeToken,
  fetchServers,
} from '../lib/device-auth';

const mockPollDeviceAuth = vi.mocked(pollDeviceAuth);
const mockExchangeToken = vi.mocked(exchangeToken);
const mockFetchServers = vi.mocked(fetchServers);

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-login-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.ZOOID_CONFIG_DIR = path.join(tmpDir, '.zooid-config');
  fs.mkdirSync(path.join(tmpDir, '.zooid-config'), { recursive: true });
});

afterEach(() => {
  process.chdir(origCwd);
  delete process.env.ZOOID_CONFIG_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

function readState() {
  return JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.zooid-config', 'state.json'), 'utf-8'),
  );
}

describe('loginToZoon (no url)', () => {
  it('saves platform_token after successful login', async () => {
    mockPollDeviceAuth.mockResolvedValueOnce({
      sessionToken: 'session_abc',
      user: { email: 'ori@example.com', name: 'Ori' },
    });
    mockFetchServers.mockResolvedValueOnce([
      { id: 's1', subdomain: 'beno', url: 'https://beno.zoon.eco' },
    ]);
    mockExchangeToken.mockResolvedValueOnce({
      token: 'jwt_xyz',
      expires_in: 3600,
    });

    await runLogin(undefined);

    const state = readState();
    const entry = state.servers['https://beno.zoon.eco'];
    expect(entry.admin_token).toBe('jwt_xyz');
    expect(entry.platform_token).toBe('session_abc');
    expect(entry.auth_method).toBe('oidc');
  });

  it('saves platform_token even with no servers', async () => {
    mockPollDeviceAuth.mockResolvedValueOnce({
      sessionToken: 'session_no_server',
      user: { email: 'ori@example.com' },
    });
    mockFetchServers.mockResolvedValueOnce([]);

    await runLogin(undefined);

    const state = readState();
    const entry = state.servers['https://accounts.zooid.dev'];
    expect(entry.platform_token).toBe('session_no_server');
  });
});

describe('loginToServer (with url)', () => {
  it('saves platform_token for zoon-hosted server', async () => {
    mockPollDeviceAuth.mockResolvedValueOnce({
      sessionToken: 'session_def',
      user: { email: 'ori@example.com', name: 'Ori' },
    });
    mockExchangeToken.mockResolvedValueOnce({
      token: 'jwt_server',
      expires_in: 3600,
    });

    await runLogin('https://test.zoon.eco');

    const state = readState();
    const entry = state.servers['https://test.zoon.eco'];
    expect(entry.admin_token).toBe('jwt_server');
    expect(entry.platform_token).toBe('session_def');
    expect(entry.auth_method).toBe('oidc');
  });
});
