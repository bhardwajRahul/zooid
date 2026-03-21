/** Platform API lives at api.zooid.dev (not app.zooid.dev which is the dashboard). */
const DEFAULT_PLATFORM_URL = 'https://api.zooid.dev';

function getPlatformUrl(): string {
  return process.env.ZOON_PLATFORM_URL || DEFAULT_PLATFORM_URL;
}

export function extractSubdomain(serverUrl: string): string | null {
  try {
    const url = new URL(serverUrl);
    const match = url.hostname.match(/^([^.]+)\.zoon\.eco$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function isZoonHosted(serverUrl: string): boolean {
  return extractSubdomain(serverUrl) !== null;
}

interface FetchOptions {
  fetch?: typeof globalThis.fetch;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function platformUrl(subdomain: string, path: string): string {
  return `${getPlatformUrl()}/api/v1/servers/${subdomain}${path}`;
}

export interface RoleDef {
  name: string;
  scopes: string[];
  description?: string;
}

export interface SyncRolesResult {
  synced: number;
  deleted: number;
  warnings: string[];
}

export async function syncRolesToZoon(
  serverUrl: string,
  token: string,
  roles: RoleDef[],
  options?: FetchOptions,
): Promise<SyncRolesResult> {
  const subdomain = extractSubdomain(serverUrl);
  if (!subdomain) {
    throw new Error(`${serverUrl} is not a Zoon-hosted server`);
  }
  const _fetch = options?.fetch ?? globalThis.fetch;
  const res = await _fetch(platformUrl(subdomain, '/roles'), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(roles),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Role sync failed: ${(err as Record<string, string>).message || res.status}`,
    );
  }
  return res.json() as Promise<SyncRolesResult>;
}

export interface CredentialResult {
  name: string;
  client_id: string;
  client_secret: string;
}

export async function createCredential(
  serverUrl: string,
  token: string,
  name: string,
  roleNames: string[],
  options?: FetchOptions,
): Promise<CredentialResult> {
  const subdomain = extractSubdomain(serverUrl)!;
  const _fetch = options?.fetch ?? globalThis.fetch;

  // Resolve role names to IDs
  const rolesRes = await _fetch(platformUrl(subdomain, '/roles'), {
    headers: authHeaders(token),
  });
  const roles = (await rolesRes.json()) as Array<{
    id: string;
    name: string;
  }>;
  const roleIds = roleNames
    .map((n) => roles.find((r) => r.name === n)?.id)
    .filter(Boolean) as string[];

  if (roleIds.length === 0) {
    throw new Error(`No matching roles found for: ${roleNames.join(', ')}`);
  }

  const res = await _fetch(platformUrl(subdomain, '/credentials'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, role_ids: roleIds }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Credential creation failed: ${(err as Record<string, string>).message || res.status}`,
    );
  }

  return res.json() as Promise<CredentialResult>;
}

export interface CredentialListItem {
  name: string;
  client_id: string;
  roles: string[];
  created_at?: string;
}

export async function listCredentials(
  serverUrl: string,
  token: string,
  options?: FetchOptions,
): Promise<CredentialListItem[]> {
  const subdomain = extractSubdomain(serverUrl)!;
  const _fetch = options?.fetch ?? globalThis.fetch;
  const res = await _fetch(platformUrl(subdomain, '/credentials'), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to list credentials: ${res.status}`);
  const data = (await res.json()) as { credentials: CredentialListItem[] };
  return data.credentials;
}

export async function rotateCredential(
  serverUrl: string,
  token: string,
  clientId: string,
  options?: FetchOptions,
): Promise<{ client_id: string; client_secret: string }> {
  const subdomain = extractSubdomain(serverUrl)!;
  const _fetch = options?.fetch ?? globalThis.fetch;
  const res = await _fetch(
    platformUrl(subdomain, `/credentials/${clientId}/rotate`),
    { method: 'POST', headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to rotate credential: ${res.status}`);
  return res.json() as Promise<{ client_id: string; client_secret: string }>;
}

export async function listRolesFromZoon(
  serverUrl: string,
  token: string,
  options?: FetchOptions,
): Promise<
  Array<{ id: string; name: string; scopes: string[]; description?: string }>
> {
  const subdomain = extractSubdomain(serverUrl)!;
  const _fetch = options?.fetch ?? globalThis.fetch;
  const res = await _fetch(platformUrl(subdomain, '/roles'), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to list roles: ${res.status}`);
  return res.json() as Promise<
    Array<{ id: string; name: string; scopes: string[]; description?: string }>
  >;
}

export async function revokeCredential(
  serverUrl: string,
  token: string,
  clientId: string,
  options?: FetchOptions,
): Promise<void> {
  const subdomain = extractSubdomain(serverUrl)!;
  const _fetch = options?.fetch ?? globalThis.fetch;
  const res = await _fetch(platformUrl(subdomain, `/credentials/${clientId}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to revoke credential: ${res.status}`);
}
