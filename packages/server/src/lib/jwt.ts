import { sign, verify } from 'hono/jwt';
import type { ZooidJWT, Bindings, TrustedKeyRow } from '../types';
import { getTrustedKeysFromCache } from './key-cache';
import { importPrivateKey } from './signing';

// --- Base64url utilities ---

function base64urlEncodeString(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlEncodeBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecodeString(str: string): string {
  const padded =
    str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4);
  return atob(padded);
}

function base64urlDecodeBuffer(str: string): ArrayBuffer {
  const binary = base64urlDecodeString(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// --- Scope hierarchy ---

const SCOPE_HIERARCHY: Record<string, number> = {
  subscribe: 0,
  publish: 1,
  admin: 2,
};

function isScopeAllowed(requested: string, maxScope: string): boolean {
  return (
    (SCOPE_HIERARCHY[requested] ?? -1) <= (SCOPE_HIERARCHY[maxScope] ?? -1)
  );
}

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
): Promise<ZooidJWT> {
  const payload = await verify(token, secret, 'HS256');
  return payload as unknown as ZooidJWT;
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

  // Enforce scope ceiling
  if (keyRow.max_scope && !isScopeAllowed(payload.scope, keyRow.max_scope)) {
    throw new Error('Scope exceeds key ceiling');
  }

  // Enforce channel allowlist
  if (keyRow.allowed_channels) {
    const allowed: string[] = JSON.parse(keyRow.allowed_channels);
    const claimed =
      payload.channels ?? (payload.channel ? [payload.channel] : []);
    for (const ch of claimed) {
      if (!channelMatchesAllowlist(ch, allowed)) {
        throw new Error(`Channel "${ch}" not allowed for this key`);
      }
    }
  }

  return payload;
}

/** Check if a channel ID matches an allowlist entry (exact or prefix.*) */
function channelMatchesAllowlist(
  channelId: string,
  allowed: string[],
): boolean {
  for (const entry of allowed) {
    if (entry.endsWith('.*')) {
      const prefix = entry.slice(0, -1); // keep the dot: "foo."
      if (channelId.startsWith(prefix)) return true;
    } else {
      if (channelId === entry) return true;
    }
  }
  return false;
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
  env: { ZOOID_JWT_SECRET?: string; DB: D1Database },
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

    const payload = await verifyEdDSAToken(token, keyRow);
    return { payload, kid: header.kid, issuer: keyRow.issuer ?? undefined };
  }

  // HS256 path — legacy shared secret
  if ((header.alg === 'HS256' || !header.alg) && env.ZOOID_JWT_SECRET) {
    const payload = await verifyToken(token, env.ZOOID_JWT_SECRET);
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
  env: Pick<Bindings, 'ZOOID_SIGNING_KEY' | 'ZOOID_JWT_SECRET' | 'DB'>,
  options?: { expiresIn?: number },
): Promise<string> {
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

/** Check whether a token grants access to a specific channel.
 *  Supports both new `channels: [...]` and legacy `channel: "..."` claims. */
export function tokenCoversChannel(
  payload: ZooidJWT,
  channelId: string,
): boolean {
  if (payload.channels) return payload.channels.includes(channelId);
  if (payload.channel) return payload.channel === channelId;
  return false;
}
