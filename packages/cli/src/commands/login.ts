import fs from 'node:fs';
import path from 'node:path';
import { cliLogin, pollDeviceAuth } from '../lib/device-auth';
import { saveConfig } from '../lib/config';
import { normalizeServerUrl } from '../lib/client';
import { printSuccess, printInfo } from '../lib/output';

const ACCOUNTS_URL = 'https://accounts.zooid.dev';
const PLATFORM_URL = 'https://api.zooid.dev';

/** Write or update zooid.json in cwd with the server URL. */
function writeProjectConfig(serverUrl: string): void {
  const configPath = path.join(process.cwd(), 'zooid.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    // Doesn't exist or invalid — start fresh
  }
  existing.url = serverUrl;
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
}

interface LoginOptions {
  fetch?: typeof globalThis.fetch;
}

export async function runLogin(
  url: string | undefined,
  options?: LoginOptions,
): Promise<void> {
  const _fetch = options?.fetch ?? globalThis.fetch;

  if (url) {
    return loginToServer(normalizeServerUrl(url), _fetch);
  }

  return loginToZoon(_fetch);
}

/**
 * Flow A: `zooid login` (no arg) — Zoon platform login.
 * 1. Device code flow with Zoon accounts → platform session token
 * 2. Fetch server list from platform API
 * 3. CLI login against the first server's tenant → Zooid JWT
 * 4. Save both tokens to state.json
 */
async function loginToZoon(_fetch: typeof globalThis.fetch): Promise<void> {
  process.stderr.write('\nOpening browser to authenticate with Zoon...\n');

  const platformResult = await pollDeviceAuth(ACCOUNTS_URL, { fetch: _fetch });
  process.stderr.write(
    `\nLogged in as ${platformResult.user.name || platformResult.user.email}\n`,
  );

  // Fetch server list from platform API
  const serversRes = await _fetch(`${PLATFORM_URL}/api/v1/servers`, {
    headers: { Authorization: `Bearer ${platformResult.token}` },
  });

  if (!serversRes.ok) {
    throw new Error(`Failed to fetch servers: ${serversRes.status}`);
  }

  const servers = (await serversRes.json()) as Array<{
    subdomain: string;
    url: string;
  }>;

  if (servers.length === 0) {
    process.stderr.write('\nNo servers found. Create one at app.zooid.dev\n');
    return;
  }

  // Now do CLI login against the first server to get a Zooid JWT
  const targetServer = servers[0].url;
  process.stderr.write(`\nAuthenticating with ${targetServer}...\n`);

  const tenantResult = await cliLogin(targetServer, { fetch: _fetch });

  // Save the Zooid JWT (for tenant operations) + platform token (for platform API)
  saveConfig(
    {
      admin_token: tenantResult.token,
      refresh_token: tenantResult.refreshToken,
      platform_token: platformResult.token,
      auth_method: 'oidc' as const,
    },
    targetServer,
    { setCurrent: true },
  );

  // Save platform token for other servers (credentials, roles sync)
  for (let i = 1; i < servers.length; i++) {
    saveConfig(
      {
        platform_token: platformResult.token,
        auth_method: 'oidc' as const,
      },
      servers[i].url,
      { setCurrent: false },
    );
  }

  // Link current directory to the first server
  writeProjectConfig(targetServer);

  process.stderr.write('\nYour servers:\n');
  for (let i = 0; i < servers.length; i++) {
    const prefix = i === 0 ? '  ● ' : '    ';
    const suffix = i === 0 ? ' (set as current)' : '';
    process.stderr.write(`${prefix}${servers[i].url}${suffix}\n`);
  }
  printInfo('Project', `zooid.json → ${targetServer}`);
  process.stderr.write('\n');
}

/**
 * Flow B: `zooid login <url>` — Server-specific login.
 * 1. Check /.well-known/zooid.json for auth_url (OIDC must be configured)
 * 2. CLI login against the server's tenant → Zooid JWT
 * 3. Save to state.json
 */
async function loginToServer(
  serverUrl: string,
  _fetch: typeof globalThis.fetch,
): Promise<void> {
  // Verify the server has OIDC configured
  const wellKnownRes = await _fetch(`${serverUrl}/.well-known/zooid.json`);
  const wellKnown = (await wellKnownRes.json()) as Record<string, unknown>;
  const authUrl = wellKnown.auth_url as string | undefined;

  if (!authUrl) {
    throw new Error(
      "This server doesn't have OIDC configured. Use `npx zooid token mint` instead.",
    );
  }

  process.stderr.write(`\nAuthenticating with ${serverUrl}...\n`);

  const result = await cliLogin(serverUrl, { fetch: _fetch });

  saveConfig(
    {
      admin_token: result.token,
      refresh_token: result.refreshToken,
      auth_method: 'oidc' as const,
    },
    serverUrl,
    { setCurrent: true },
  );

  writeProjectConfig(serverUrl);
  printSuccess(`Server: ${serverUrl} (set as current)`);
  printInfo('Project', `zooid.json → ${serverUrl}`);
}
