import { sign, verify } from 'hono/jwt';
import type { ZooidJWT, Bindings, TrustedKeyRow } from '../types';
import { getTrustedKeysFromCache } from './key-cache';
import { importPrivateKey } from './signing';
import {
  base64urlEncodeString,
  base64urlEncodeBuffer,
  base64urlDecodeString,
  base64urlDecodeBuffer,
  normalizeScopes,
  enforceScopeCeiling,
} from '@zooid/auth';

// Re-export scope utilities from @zooid/auth for backward compat
export {
  normalizeScopes,
  scopeMatchesPattern,
  hasScope,
  canPublish,
  canSubscribe,
  isAdmin,
  enforceScopeCeiling,
} from '@zooid/auth';

// --- HS256 (legacy) ---

export async function createToken(
  claims: Partial<ZooidJWT>,
  secret: string,
  options?: { expiresIn?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    ...claims,
    iat: now,
  };

  if (options?.expiresIn !== undefined) {
    payload.exp = now + options.expiresIn;
  }

  return sign(payload, secret, 'HS256');
}

export async function verifyToken(
  token: string,
  secret: string,
  serverUrl?: string,
): Promise<ZooidJWT> {
  const payload = await verify(token, secret, 'HS256');
  const jwt = payload as unknown as ZooidJWT;

  // Check audience (reject mismatched, accept missing for backward compat)
  if (jwt.aud && serverUrl && jwt.aud !== serverUrl) {
    throw new Error('Token audience mismatch');
  }

  return jwt;
}

// --- EdDSA (new) ---

export async function createEdDSAToken(
  claims: Partial<ZooidJWT>,
  privateKeyJwk: JsonWebKey,
  kid: string,
  options?: { expiresIn?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { ...claims, iat: now };

  if (options?.expiresIn !== undefined) {
    payload.exp = now + options.expiresIn;
  }

  const header = base64urlEncodeString(
    JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid }),
  );
  const body = base64urlEncodeString(JSON.stringify(payload));
  const message = `${header}.${body}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'Ed25519' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(message),
  );

  return `${message}.${base64urlEncodeBuffer(signature)}`;
}

/**
 * Verify an EdDSA JWT against a trusted key row from D1.
 * Returns the payload plus the kid from the header.
 */
export async function verifyEdDSAToken(
  token: string,
  keyRow: TrustedKeyRow,
  serverUrl?: string,
): Promise<ZooidJWT> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [headerB64, payloadB64, signatureB64] = parts;

  // Import public key from JWK components
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    { kty: keyRow.kty, crv: keyRow.crv, x: keyRow.x },
    { name: 'Ed25519' },
    false,
    ['verify'],
  );

  // Verify signature
  const message = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecodeBuffer(signatureB64);
  const valid = await crypto.subtle.verify(
    'Ed25519',
    publicKey,
    signature,
    message,
  );
  if (!valid) throw new Error('Invalid signature');

  // Decode and validate payload
  const payload = JSON.parse(base64urlDecodeString(payloadB64)) as ZooidJWT;

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  // Check audience (reject mismatched, accept missing for backward compat)
  if (payload.aud && serverUrl && payload.aud !== serverUrl) {
    throw new Error('Token audience mismatch');
  }

  // Normalize scopes and enforce ceiling
  const scopes = normalizeScopes(payload);
  const maxScopes = keyRow.max_scopes
    ? (JSON.parse(keyRow.max_scopes) as string[])
    : null;
  enforceScopeCeiling(scopes, maxScopes);

  return payload;
}

// --- Dual verification ---

export interface VerifyResult {
  payload: ZooidJWT;
  kid?: string;
  issuer?: string;
}

/**
 * Verify a token using either HS256 (legacy) or EdDSA (JWKS).
 * Peeks at the JWT header to determine which path to use.
 */
export async function verifyTokenAny(
  token: string,
  env: { ZOOID_JWT_SECRET?: string; ZOOID_SERVER_URL?: string; DB: D1Database },
): Promise<VerifyResult> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) throw new Error('Malformed token');

  const headerB64 = token.slice(0, dotIndex);
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(base64urlDecodeString(headerB64));
  } catch {
    throw new Error('Malformed token header');
  }

  // EdDSA path — look up kid in cached trust store
  if (header.alg === 'EdDSA' && header.kid) {
    const keys = await getTrustedKeysFromCache(env.DB);
    const keyRow = keys.get(header.kid);
    if (!keyRow) throw new Error('Unknown key ID');

    const payload = await verifyEdDSAToken(token, keyRow, env.ZOOID_SERVER_URL);
    return { payload, kid: header.kid, issuer: keyRow.issuer ?? undefined };
  }

  // HS256 path — legacy shared secret
  if ((header.alg === 'HS256' || !header.alg) && env.ZOOID_JWT_SECRET) {
    const payload = await verifyToken(
      token,
      env.ZOOID_JWT_SECRET,
      env.ZOOID_SERVER_URL,
    );
    return { payload };
  }

  throw new Error('Unsupported token format');
}

// --- Server-side minting ---

/**
 * Mint a token using the server's signing key.
 * Tries EdDSA first (requires ZOOID_SIGNING_KEY + matching kid in trusted_keys).
 * Falls back to HS256 with ZOOID_JWT_SECRET.
 */
export async function mintServerToken(
  claims: Partial<ZooidJWT>,
  env: Pick<
    Bindings,
    'ZOOID_SIGNING_KEY' | 'ZOOID_JWT_SECRET' | 'ZOOID_SERVER_URL' | 'DB'
  >,
  options?: { expiresIn?: number },
): Promise<string> {
  // Include audience claim if server URL is configured
  if (env.ZOOID_SERVER_URL && !claims.aud) {
    claims = { ...claims, aud: env.ZOOID_SERVER_URL };
  }
  if (env.ZOOID_SIGNING_KEY) {
    const privateKey = await importPrivateKey(env.ZOOID_SIGNING_KEY);
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);

    // Find the kid that matches this signing key's public component
    const keys = await getTrustedKeysFromCache(env.DB);
    let kid: string | undefined;
    for (const [k, row] of keys) {
      if (row.x === jwk.x) {
        kid = k;
        break;
      }
    }

    if (kid) {
      return createEdDSAToken(claims, jwk, kid, options);
    }
  }

  // Fall back to HS256
  if (env.ZOOID_JWT_SECRET) {
    return createToken(claims, env.ZOOID_JWT_SECRET, options);
  }

  throw new Error('No signing key available');
}

/** @deprecated Use normalizeScopes + canPublish/canSubscribe instead */
export function tokenCoversChannel(
  payload: ZooidJWT,
  channelId: string,
): boolean {
  const scopes = normalizeScopes(payload);
  // Check both pub and sub — this function was used in both publish and subscribe contexts
  return canPublish(scopes, channelId) || canSubscribe(scopes, channelId);
}
