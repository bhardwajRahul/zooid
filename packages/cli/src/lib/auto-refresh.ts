import type { ServerConfig } from './config';

interface RefreshOptions {
  save: (partial: Partial<ServerConfig>) => void;
  fetch?: typeof globalThis.fetch;
}

/**
 * Decode JWT payload without verification (just for reading exp).
 * This is safe because we only use it to decide whether to refresh,
 * not for authorization.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1]);
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * If the stored JWT is within 2 minutes of expiry and we have a refresh_token,
 * attempt to refresh. Updates state.json via the save callback.
 */
export async function maybeRefreshToken(
  serverConfig: Partial<ServerConfig>,
  serverUrl: string,
  options: RefreshOptions,
): Promise<void> {
  if (serverConfig.auth_method !== 'oidc') return;
  if (!serverConfig.refresh_token) return;
  if (!serverConfig.admin_token) return;

  const payload = decodeJwtPayload(serverConfig.admin_token);
  if (!payload?.exp) return;

  const expiresAt = (payload.exp as number) * 1000;
  const twoMinutes = 2 * 60 * 1000;

  if (Date.now() < expiresAt - twoMinutes) return;

  // Token is near expiry — refresh
  const _fetch = options.fetch ?? globalThis.fetch;
  try {
    const res = await _fetch(`${serverUrl}/api/v1/auth/cli-refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serverConfig.admin_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: serverConfig.refresh_token }),
    });

    if (!res.ok) {
      process.stderr.write(
        'Session expired. Run `npx zooid login` to re-authenticate.\n',
      );
      return;
    }

    const data = (await res.json()) as {
      token: string;
      refresh_token?: string;
    };

    options.save({
      admin_token: data.token,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    });
  } catch {
    // Silently fail — the original token might still work
  }
}
