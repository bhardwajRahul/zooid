import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export interface CliLoginResult {
  token: string;
  refreshToken?: string;
}

export interface DeviceAuthResult {
  token: string;
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
 * CLI login against a Zooid server's OIDC flow (per cli-oauth-spec).
 *
 * 1. Generate a UUID session ID
 * 2. Open browser to {server}/api/v1/auth/login?cli_session={uuid}
 * 3. Server runs the normal OIDC flow and stores the resulting JWT
 * 4. CLI polls {server}/api/v1/auth/cli/{uuid} until complete
 * 5. Returns the Zooid JWT + encrypted refresh token
 */
export async function cliLogin(
  serverUrl: string,
  options?: CliLoginOptions,
): Promise<CliLoginResult> {
  const _fetch = options?.fetch ?? globalThis.fetch;
  const openBrowser = options?.openBrowser ?? defaultOpenBrowser;

  const sessionId = randomUUID();
  const loginUrl = `${serverUrl}/api/v1/auth/login?cli_session=${sessionId}`;

  process.stderr.write(`If the browser doesn't open, visit:\n  ${loginUrl}\n`);
  openBrowser(loginUrl);

  // Poll for completion (2s interval, 5 minute timeout)
  const deadline = Date.now() + 5 * 60 * 1000;
  const interval = 2000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) {
        reject(new Error('Authentication timed out. Please try again.'));
        return;
      }

      try {
        const res = await _fetch(`${serverUrl}/api/v1/auth/cli/${sessionId}`);

        if (res.status === 202) {
          // Still pending
          setTimeout(poll, interval);
          return;
        }

        if (res.status === 404) {
          reject(new Error('Session expired or not found. Please try again.'));
          return;
        }

        if (res.ok) {
          const data = (await res.json()) as {
            status: string;
            token?: string;
            refresh_token?: string;
          };

          if (data.status === 'complete' && data.token) {
            resolve({
              token: data.token,
              refreshToken: data.refresh_token ?? undefined,
            });
            return;
          }
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
 * Device code flow for Zoon accounts (platform-only auth).
 * Used by `zooid login` (no arg) to get a server list.
 */
export async function pollDeviceAuth(
  accountsUrl: string,
  options?: CliLoginOptions,
): Promise<DeviceAuthResult> {
  const _fetch = options?.fetch ?? globalThis.fetch;
  const openBrowser = options?.openBrowser ?? defaultOpenBrowser;

  // Initiate device code flow
  const initRes = await _fetch(`${accountsUrl}/api/auth/device`, {
    method: 'POST',
  });
  if (!initRes.ok) {
    throw new Error(`Failed to initiate device auth: ${initRes.status}`);
  }
  const init = (await initRes.json()) as {
    device_code: string;
    verification_url: string;
    expires_in: number;
    poll_interval: number;
  };

  process.stderr.write(
    `If the browser doesn't open, visit:\n  ${init.verification_url}\n`,
  );
  openBrowser(init.verification_url);

  // Poll for completion
  const deadline = Date.now() + init.expires_in * 1000;
  const interval = init.poll_interval * 1000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) {
        reject(new Error('Authentication timed out. Please try again.'));
        return;
      }

      try {
        const res = await _fetch(
          `${accountsUrl}/api/auth/device/status?code=${init.device_code}`,
        );
        const data = (await res.json()) as {
          status: string;
          token?: string;
          user?: { email: string; name?: string };
        };

        if (data.status === 'complete' && data.token && data.user) {
          resolve({ token: data.token, user: data.user });
          return;
        }
        if (data.status === 'expired') {
          reject(new Error('Device code expired. Please try again.'));
          return;
        }
      } catch {
        // Network error — keep polling
      }

      setTimeout(poll, interval);
    };

    setTimeout(poll, interval);
  });
}
