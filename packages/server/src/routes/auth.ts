import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import {
  discoverOIDC,
  exchangeCode,
  refreshAccessToken,
  fetchUserInfo,
  generateCodeVerifier,
  generateCodeChallenge,
} from '../lib/oidc';
import { resolveScopes, type OIDCClaims } from '../lib/scope-mapper';
import { mintServerToken } from '../lib/jwt';

type Env = { Bindings: Bindings; Variables: Variables };

const ZOOID_JWT_TTL = 15 * 60; // 15 minutes
const REFRESH_COOKIE_TTL = 7 * 24 * 60 * 60; // 7 days
const REFRESH_COOKIE_NAME = 'zooid_refresh';
const STATE_COOKIE_NAME = 'zooid_auth_state';

const auth = new Hono<Env>();

/**
 * Helper to get the server's base URL for constructing redirect URIs.
 */
function getServerUrl(c: { env: Bindings; req: { url: string } }): string {
  return c.env.ZOOID_SERVER_URL || new URL(c.req.url).origin;
}

/**
 * Get the secret used for cookie encryption.
 * Prefers ZOOID_SIGNING_KEY (EdDSA deploys), falls back to ZOOID_JWT_SECRET (legacy).
 */
function getCookieSecret(env: Bindings): string {
  const secret = env.ZOOID_SIGNING_KEY || env.ZOOID_JWT_SECRET;
  if (!secret) throw new Error('No signing key or JWT secret configured');
  return secret;
}

/**
 * Encrypt/decrypt OIDC refresh token using AES-GCM.
 * This keeps the refresh token opaque in the cookie.
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('zooid-refresh'),
      iterations: 1,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptRefreshToken(
  token: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  );
  // Encode as base64: iv (12 bytes) + ciphertext
  const combined = new Uint8Array(
    iv.length + new Uint8Array(ciphertext).length,
  );
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  let binary = '';
  for (const byte of combined) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function decryptRefreshToken(
  encrypted: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const padded =
    encrypted.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (encrypted.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

// --- GET /auth/login ---
// Initiates OIDC authorization code flow with PKCE.
// Redirects browser to the OIDC provider's authorize endpoint.

auth.get('/auth/login', async (c) => {
  const issuer = c.env.ZOOID_OIDC_ISSUER;
  const clientId = c.env.ZOOID_OIDC_CLIENT_ID;

  if (!issuer || !clientId) {
    return c.json({ error: 'OIDC not configured' }, 503);
  }

  const config = await discoverOIDC(issuer);
  const serverUrl = getServerUrl(c);
  const redirectUri = `${serverUrl}/api/v1/auth/callback`;

  // Generate PKCE pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Generate state for CSRF protection
  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  let stateBinary = '';
  for (const byte of stateBytes) stateBinary += String.fromCharCode(byte);
  const state = btoa(stateBinary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  // Store verifier + state in an HttpOnly cookie (short-lived, for the callback)
  const stateData = JSON.stringify({ v: codeVerifier, s: state });
  const encrypted = await encryptRefreshToken(
    stateData,
    getCookieSecret(c.env),
  );

  const authUrl = new URL(config.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Set state cookie and redirect
  c.header(
    'Set-Cookie',
    `${STATE_COOKIE_NAME}=${encrypted}; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  return c.redirect(authUrl.toString());
});

// --- GET /auth/callback ---
// Handles the OIDC authorization code callback.
// Exchanges code for tokens, extracts claims, mints Zooid JWT, sets refresh cookie.

auth.get('/auth/callback', async (c) => {
  const issuer = c.env.ZOOID_OIDC_ISSUER;
  const clientId = c.env.ZOOID_OIDC_CLIENT_ID;
  const clientSecret = c.env.ZOOID_OIDC_CLIENT_SECRET;

  if (!issuer || !clientId || !clientSecret) {
    return c.json({ error: 'OIDC not configured' }, 503);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    const desc = c.req.query('error_description') || error;
    return c.html(errorPage('Authentication failed', desc), 400);
  }

  if (!code || !state) {
    return c.html(
      errorPage('Invalid callback', 'Missing code or state parameter'),
      400,
    );
  }

  // Retrieve and verify state cookie
  const cookies = parseCookies(c.req.header('Cookie') || '');
  const stateCookie = cookies[STATE_COOKIE_NAME];
  if (!stateCookie) {
    return c.html(
      errorPage('Session expired', 'Please try signing in again'),
      400,
    );
  }

  let stateData: { v: string; s: string };
  try {
    const decrypted = await decryptRefreshToken(
      stateCookie,
      getCookieSecret(c.env),
    );
    stateData = JSON.parse(decrypted);
  } catch {
    return c.html(
      errorPage('Invalid session', 'Please try signing in again'),
      400,
    );
  }

  // CSRF check
  if (stateData.s !== state) {
    return c.html(
      errorPage(
        'State mismatch',
        'CSRF protection triggered. Please try again.',
      ),
      400,
    );
  }

  const config = await discoverOIDC(issuer);
  const serverUrl = getServerUrl(c);
  const redirectUri = `${serverUrl}/api/v1/auth/callback`;

  // Exchange code for tokens
  const tokens = await exchangeCode(config.token_endpoint, {
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: stateData.v,
  });

  // Fetch user info to get claims (more reliable than parsing id_token)
  const userInfo = await fetchUserInfo(
    config.userinfo_endpoint,
    tokens.access_token,
  );

  const oidcClaims: OIDCClaims = {
    sub: (userInfo.sub as string) || 'unknown',
    name: userInfo.name as string | undefined,
    email: userInfo.email as string | undefined,
    preferred_username: userInfo.preferred_username as string | undefined,
    groups: userInfo.groups as string[] | undefined,
    'https://zooid.dev/scopes': userInfo['https://zooid.dev/scopes'] as
      | string[]
      | undefined,
  };

  // Map OIDC claims to Zooid scopes
  const resolved = resolveScopes(oidcClaims, c.env);

  // Mint Zooid JWT
  const zooidToken = await mintServerToken(
    {
      scopes: resolved.scopes,
      sub: resolved.sub,
      name: resolved.name,
      groups: resolved.groups,
    },
    c.env,
    { expiresIn: ZOOID_JWT_TTL },
  );

  // Clear state cookie
  c.header(
    'Set-Cookie',
    `${STATE_COOKIE_NAME}=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    { append: true },
  );

  // Set refresh cookie if we got one
  if (tokens.refresh_token) {
    const encryptedRefresh = await encryptRefreshToken(
      tokens.refresh_token,
      getCookieSecret(c.env),
    );
    c.header(
      'Set-Cookie',
      `${REFRESH_COOKIE_NAME}=${encryptedRefresh}; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${REFRESH_COOKIE_TTL}`,
      { append: true },
    );
  }

  // Return HTML that stores the JWT in localStorage and redirects to dashboard
  return c.html(callbackPage(zooidToken));
});

// --- POST /auth/refresh ---
// Uses the encrypted OIDC refresh token cookie to get a new Zooid JWT.

auth.post('/auth/refresh', async (c) => {
  const issuer = c.env.ZOOID_OIDC_ISSUER;
  const clientId = c.env.ZOOID_OIDC_CLIENT_ID;
  const clientSecret = c.env.ZOOID_OIDC_CLIENT_SECRET;

  if (!issuer || !clientId || !clientSecret) {
    return c.json({ error: 'OIDC not configured' }, 503);
  }

  const cookies = parseCookies(c.req.header('Cookie') || '');
  const refreshCookie = cookies[REFRESH_COOKIE_NAME];
  if (!refreshCookie) {
    return c.json({ error: 'No refresh token' }, 401);
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptRefreshToken(
      refreshCookie,
      getCookieSecret(c.env),
    );
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  const config = await discoverOIDC(issuer);

  // Refresh at the OIDC provider
  let tokens;
  try {
    tokens = await refreshAccessToken(config.token_endpoint, {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
  } catch {
    // Refresh failed — user may have been banned or token revoked
    // Clear the cookie
    c.header(
      'Set-Cookie',
      `${REFRESH_COOKIE_NAME}=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    );
    return c.json({ error: 'Refresh failed — please sign in again' }, 401);
  }

  // Re-fetch user info with new access token
  const userInfo = await fetchUserInfo(
    config.userinfo_endpoint,
    tokens.access_token,
  );

  const oidcClaims: OIDCClaims = {
    sub: (userInfo.sub as string) || 'unknown',
    name: userInfo.name as string | undefined,
    email: userInfo.email as string | undefined,
    preferred_username: userInfo.preferred_username as string | undefined,
    groups: userInfo.groups as string[] | undefined,
    'https://zooid.dev/scopes': userInfo['https://zooid.dev/scopes'] as
      | string[]
      | undefined,
  };

  const resolved = resolveScopes(oidcClaims, c.env);

  const zooidToken = await mintServerToken(
    {
      scopes: resolved.scopes,
      sub: resolved.sub,
      name: resolved.name,
    },
    c.env,
    { expiresIn: ZOOID_JWT_TTL },
  );

  // Update refresh cookie if provider rotated it
  if (tokens.refresh_token) {
    const encryptedRefresh = await encryptRefreshToken(
      tokens.refresh_token,
      getCookieSecret(c.env),
    );
    c.header(
      'Set-Cookie',
      `${REFRESH_COOKIE_NAME}=${encryptedRefresh}; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${REFRESH_COOKIE_TTL}`,
    );
  }

  return c.json({ token: zooidToken });
});

// --- POST /auth/logout ---
// Clears the refresh cookie. Optionally revokes at the OIDC provider.

auth.post('/auth/logout', async (c) => {
  c.header(
    'Set-Cookie',
    `${REFRESH_COOKIE_NAME}=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );
  return c.json({ ok: true });
});

// --- GET /auth/session ---
// Returns whether the user has a valid refresh cookie (without exposing it).

auth.get('/auth/session', async (c) => {
  const cookies = parseCookies(c.req.header('Cookie') || '');
  const hasRefresh = !!cookies[REFRESH_COOKIE_NAME];
  return c.json({ authenticated: hasRefresh });
});

// --- Helpers ---

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  }
  return cookies;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function errorPage(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html>
<head><title>${safeTitle}</title><style>
body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
.card { text-align: center; max-width: 400px; padding: 2rem; }
h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
p { color: #888; font-size: 0.875rem; }
a { color: #3b82f6; text-decoration: none; }
</style></head>
<body><div class="card">
<h1>${safeTitle}</h1>
<p>${safeMessage}</p>
<p style="margin-top: 1rem;"><a href="/">Back to dashboard</a></p>
</div></body></html>`;
}

function callbackPage(token: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Signing in...</title><style>
body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
.card { text-align: center; }
</style></head>
<body><div class="card"><p>Signing in...</p></div>
<script>
try {
  // Store token and redirect back to the dashboard
  localStorage.setItem('zooid_token', ${JSON.stringify(token)});
  window.location.href = '/';
} catch (e) {
  document.querySelector('.card').innerHTML = '<p>Sign-in failed. Please close this window and try again.</p>';
}
</script>
</body></html>`;
}

export { auth };
