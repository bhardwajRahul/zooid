import { exec } from 'node:child_process';

export interface DeviceAuthResult {
  /** Session token from the device authorization flow */
  sessionToken: string;
  user: { email: string; name?: string };
}

interface CliLoginOptions {
  fetch?: typeof globalThis.fetch;
  openBrowser?: (url: string) => void;
}

function defaultOpenBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  try {
    exec(`${cmd} ${JSON.stringify(url)}`);
  } catch {
    // Silently fail — URL is printed for manual use
  }
}

/**
 * RFC 8628 Device Authorization Grant for Zoon accounts.
 *
 * 1. POST /api/auth/device/code → device_code + user_code
 * 2. Open browser to verification_uri_complete
 * 3. Poll POST /api/auth/device/token → session token
 */
export async function pollDeviceAuth(
  accountsUrl: string,
  options?: CliLoginOptions,
): Promise<DeviceAuthResult> {
  const _fetch = options?.fetch ?? globalThis.fetch;
  const openBrowser = options?.openBrowser ?? defaultOpenBrowser;

  // 1. Initiate device authorization (RFC 8628)
  const initRes = await _fetch(`${accountsUrl}/api/auth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: 'zooid-cli' }),
  });
  if (!initRes.ok) {
    throw new Error(`Failed to initiate device auth: ${initRes.status}`);
  }
  const init = (await initRes.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
  };

  process.stderr.write(
    `If the browser doesn't open, visit:\n  ${init.verification_uri_complete}\n`,
  );
  openBrowser(init.verification_uri_complete);

  // 2. Poll token endpoint (RFC 8628 Section 3.4)
  const deadline = Date.now() + init.expires_in * 1000;
  const interval = (init.interval ?? 5) * 1000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) {
        reject(new Error('Authentication timed out. Please try again.'));
        return;
      }

      try {
        const res = await _fetch(`${accountsUrl}/api/auth/device/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: init.device_code,
            client_id: 'zooid-cli',
          }),
        });

        if (res.status === 200) {
          const data = (await res.json()) as {
            access_token: string;
            token_type: string;
            expires_in: number;
          };

          // Get user info using the session token
          const sessionRes = await _fetch(
            `${accountsUrl}/api/auth/get-session`,
            {
              headers: { Authorization: `Bearer ${data.access_token}` },
            },
          );
          let user = {
            email: 'unknown' as string,
            name: undefined as string | undefined,
          };
          if (sessionRes.ok) {
            const session = (await sessionRes.json()) as {
              user?: { email: string; name?: string };
            };
            if (session.user) {
              user = { email: session.user.email, name: session.user.name };
            }
          }

          resolve({ sessionToken: data.access_token, user });
          return;
        }

        if (res.status === 400) {
          const error = (await res.json()) as { error: string };
          if (error.error === 'expired_token') {
            reject(new Error('Device code expired. Please try again.'));
            return;
          }
          // authorization_pending or slow_down → keep polling
        }
      } catch {
        // Network error — keep polling
      }

      setTimeout(poll, interval);
    };

    setTimeout(poll, interval);
  });
}

/**
 * Exchange a session token for a server-scoped JWT.
 */
export async function exchangeToken(
  accountsUrl: string,
  sessionToken: string,
  serverUrl: string,
  options?: { fetch?: typeof globalThis.fetch },
): Promise<{ token: string; expires_in: number }> {
  const _fetch = options?.fetch ?? globalThis.fetch;

  const res = await _fetch(`${accountsUrl}/api/auth/device-code/exchange`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ server_url: serverUrl }),
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as Record<
      string,
      string
    >;
    throw new Error(
      `Token exchange failed: ${error.message || error.error || res.status}`,
    );
  }

  return (await res.json()) as { token: string; expires_in: number };
}

/**
 * Fetch the user's server list from accounts.
 */
export async function fetchServers(
  accountsUrl: string,
  sessionToken: string,
  options?: { fetch?: typeof globalThis.fetch },
): Promise<Array<{ id: string; subdomain: string; url: string }>> {
  const _fetch = options?.fetch ?? globalThis.fetch;

  const res = await _fetch(`${accountsUrl}/api/auth/device-code/servers`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    servers: Array<{ id: string; subdomain: string; url: string }>;
  };
  return data.servers;
}
