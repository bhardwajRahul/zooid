import fs from 'node:fs';
import path from 'node:path';
import {
  pollDeviceAuth,
  exchangeToken,
  fetchServers,
} from '../lib/device-auth';
import { saveConfig } from '../lib/config';
import { normalizeServerUrl } from '../lib/client';
import { printSuccess, printInfo } from '../lib/output';

const ACCOUNTS_URL = 'https://accounts.zooid.dev';

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
 *
 * 1. RFC 8628 device code flow → session token
 * 2. Resolve target server (from zooid.json or server list)
 * 3. Exchange session → server-scoped JWT
 */
async function loginToZoon(_fetch: typeof globalThis.fetch): Promise<void> {
  process.stderr.write('\nOpening browser to authenticate with Zoon...\n');

  const result = await pollDeviceAuth(ACCOUNTS_URL, { fetch: _fetch });
  process.stderr.write(
    `\nLogged in as ${result.user.name || result.user.email}\n`,
  );

  // Fetch the user's server list (owned + member)
  const servers = await fetchServers(ACCOUNTS_URL, result.sessionToken, {
    fetch: _fetch,
  });

  // Resolve which server to get a JWT for
  let targetServer: string | undefined;

  // Check zooid.json in cwd first
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const configPath = path.join(process.cwd(), 'zooid.json');
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (raw.url) {
        const hasAccess = servers.some((s) => s.url === raw.url);
        if (hasAccess) {
          targetServer = raw.url;
        } else {
          printInfo(
            'Note',
            `zooid.json references ${raw.url} but you don't have access to it`,
          );
        }
      }
    }
  } catch {
    // ignore
  }

  // If no target yet, pick from server list
  if (!targetServer && servers.length > 0) {
    targetServer = servers[0].url;
  }

  // No servers at all — save platform token and exit
  if (!targetServer) {
    saveConfig(
      {
        platform_token: result.sessionToken,
        auth_method: 'oidc' as const,
      },
      ACCOUNTS_URL,
      { setCurrent: false },
    );
    printSuccess('Authenticated with Zoon');
    printInfo('Note', 'No servers found. Create one at app.zooid.dev');
    process.stderr.write('\n');
    return;
  }

  // Exchange session token for a server-scoped JWT
  const exchangeResult = await exchangeToken(
    ACCOUNTS_URL,
    result.sessionToken,
    targetServer,
    { fetch: _fetch },
  );

  saveConfig(
    {
      admin_token: exchangeResult.token,
      auth_method: 'oidc' as const,
    },
    targetServer,
    { setCurrent: true },
  );

  writeProjectConfig(targetServer);
  printSuccess(`Server: ${targetServer} (set as current)`);
  printInfo('Project', `zooid.json → ${targetServer}`);
  process.stderr.write('\n');
}

/**
 * Flow B: `zooid login <url>` — Server-specific login.
 *
 * For Zoon-hosted servers (*.zoon.eco): use the Zoon device code flow.
 * For self-hosted servers with external OIDC: not yet supported (RFC 8628 device code
 * grant against the server's OIDC provider — coming soon).
 */
async function loginToServer(
  serverUrl: string,
  _fetch: typeof globalThis.fetch,
): Promise<void> {
  // Check if this is a Zoon-hosted server
  const url = new URL(serverUrl);
  if (url.hostname.endsWith('.zoon.eco')) {
    // Zoon-hosted — use the Zoon device code flow + exchange
    process.stderr.write('\nOpening browser to authenticate with Zoon...\n');

    const result = await pollDeviceAuth(ACCOUNTS_URL, { fetch: _fetch });
    process.stderr.write(
      `\nLogged in as ${result.user.name || result.user.email}\n`,
    );

    // Exchange session token for a server-scoped JWT
    // The exchange endpoint resolves scopes based on membership/roles,
    // so any authenticated user can get a token (with appropriate scopes)
    const exchangeResult = await exchangeToken(
      ACCOUNTS_URL,
      result.sessionToken,
      serverUrl,
      { fetch: _fetch },
    );

    saveConfig(
      {
        admin_token: exchangeResult.token,
        auth_method: 'oidc' as const,
      },
      serverUrl,
      { setCurrent: true },
    );

    writeProjectConfig(serverUrl);
    printSuccess(`Server: ${serverUrl} (set as current)`);
    printInfo('Project', `zooid.json → ${serverUrl}`);
    return;
  }

  // Self-hosted with external OIDC provider
  // TODO: RFC 8628 device code grant against the server's OIDC provider
  throw new Error(
    'CLI login for self-hosted servers with external OIDC is coming soon.\n' +
      'For now, use `npx zooid token mint` to create a token manually.',
  );
}
