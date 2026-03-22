import type { ServerConfig } from './config';

interface RefreshOptions {
  save: (partial: Partial<ServerConfig>) => void;
  fetch?: typeof globalThis.fetch;
}

/**
 * Decode JWT payload without verification (just for reading exp).
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
 * If the stored JWT is within 2 minutes of expiry, prompt re-login.
 * The CLI uses 24h JWTs — re-run `npx zooid login` to refresh.
 */
export async function maybeRefreshToken(
  serverConfig: Partial<ServerConfig>,
  _serverUrl: string,
  _options: RefreshOptions,
): Promise<void> {
  if (serverConfig.auth_method !== 'oidc') return;
  if (!serverConfig.admin_token) return;

  const payload = decodeJwtPayload(serverConfig.admin_token);
  if (!payload?.exp) return;

  const expiresAt = (payload.exp as number) * 1000;
  const twoMinutes = 2 * 60 * 1000;

  if (Date.now() < expiresAt - twoMinutes) return;

  process.stderr.write(
    'Session expired. Run `npx zooid login` to re-authenticate.\n',
  );
}
