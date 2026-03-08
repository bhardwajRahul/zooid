/**
 * OIDC discovery and token exchange utilities.
 * Fetches provider configuration and exchanges authorization codes.
 */

interface OIDCConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
  jwks_uri?: string;
}

// In-memory cache for OIDC discovery (same worker instance)
let cachedConfig: {
  issuer: string;
  config: OIDCConfig;
  expiresAt: number;
} | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function discoverOIDC(issuer: string): Promise<OIDCConfig> {
  if (
    cachedConfig &&
    cachedConfig.issuer === issuer &&
    Date.now() < cachedConfig.expiresAt
  ) {
    return cachedConfig.config;
  }

  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  }

  const config = (await res.json()) as OIDCConfig;

  if (!config.authorization_endpoint || !config.token_endpoint) {
    throw new Error('OIDC discovery response missing required endpoints');
  }

  cachedConfig = { issuer, config, expiresAt: Date.now() + CACHE_TTL };
  return config;
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeCode(
  tokenEndpoint: string,
  params: {
    code: string;
    redirect_uri: string;
    client_id: string;
    client_secret: string;
    code_verifier: string;
  },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirect_uri,
    client_id: params.client_id,
    client_secret: params.client_secret,
    code_verifier: params.code_verifier,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(
  tokenEndpoint: string,
  params: {
    refresh_token: string;
    client_id: string;
    client_secret: string;
  },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refresh_token,
    client_id: params.client_id,
    client_secret: params.client_secret,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function fetchUserInfo(
  userinfoEndpoint: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Userinfo request failed: ${res.status}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Generate a random PKCE code verifier (43-128 chars, URL-safe).
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * Derive a PKCE code challenge from a code verifier (S256 method).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
