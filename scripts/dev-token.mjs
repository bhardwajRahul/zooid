#!/usr/bin/env node
/**
 * Generate a JWT token for local development.
 *
 * Usage:
 *   node scripts/dev-token.mjs admin
 *   node scripts/dev-token.mjs subscribe agent-logs
 *   node scripts/dev-token.mjs publish daily-haiku
 *
 * Flags:
 *   --eddsa              Sign with Ed25519 (registers dev key with local server)
 *   --legacy             Use single-channel claim instead of channels array
 *   --expires-in <dur>   Set token expiry (e.g. "5m", "1h", "7d", "30d")
 *
 * HS256 tokens work offline. EdDSA tokens require wrangler dev running
 * on localhost:8787 (to register the dev public key).
 */

import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const eddsa = args.includes('--eddsa');
const legacy = args.includes('--legacy');
const expiresInIdx = args.indexOf('--expires-in');
const expiresInRaw = expiresInIdx !== -1 ? args[expiresInIdx + 1] : null;
const positional = args.filter(
  (a, i) => !a.startsWith('--') && i !== expiresInIdx + 1,
);
const [scope, ...channels] = positional;

// Special commands (not token scopes)
if (scope === 'revoke' || scope === 'keys') {
  // These need the secret + constants defined below, handled after setup
} else if (!scope || !['admin', 'subscribe', 'publish'].includes(scope)) {
  console.error(
    `Usage: node scripts/dev-token.mjs <admin|subscribe|publish> [channel-id...] [--eddsa] [--legacy] [--expires-in <dur>]
       node scripts/dev-token.mjs keys                  List registered keys
       node scripts/dev-token.mjs revoke [kid]           Revoke a key (default: dev-1)`,
  );
  process.exit(1);
}

if (
  !['revoke', 'keys'].includes(scope) &&
  scope !== 'admin' &&
  channels.length === 0
) {
  console.error(`Error: ${scope} scope requires at least one channel ID`);
  console.error(
    `Usage: node scripts/dev-token.mjs ${scope} <channel-id...> [--eddsa] [--legacy]`,
  );
  process.exit(1);
}

// Read secret from server .dev.vars
const devVarsPath = resolve(
  import.meta.dirname,
  '../packages/server/.dev.vars',
);
let secret;
try {
  const vars = readFileSync(devVarsPath, 'utf-8');
  const match = vars.match(/^ZOOID_JWT_SECRET=(.+)$/m);
  if (!match) throw new Error('ZOOID_JWT_SECRET not found');
  secret = match[1].trim();
} catch (e) {
  console.error(`Error reading ${devVarsPath}: ${e.message}`);
  process.exit(1);
}

// EdDSA constants
const DEV_KEYPAIR_PATH = resolve(
  import.meta.dirname,
  '../packages/server/.dev-keypair.json',
);
const DEV_KID = 'dev-1';
const LOCAL_SERVER = 'http://localhost:8787';

// Parse --expires-in
function parseDuration(input) {
  const match = input.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    console.error(
      `Invalid duration "${input}". Use format: <number><s|m|h|d> (e.g. "5m", "1h", "7d")`,
    );
    process.exit(1);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

// Build claims
const now = Math.floor(Date.now() / 1000);
const claims = { scope, iat: now };
if (channels.length > 0) {
  if (legacy) {
    claims.channel = channels[0];
  } else {
    claims.channels = channels;
  }
}
if (expiresInRaw) {
  claims.exp = now + parseDuration(expiresInRaw);
}

if (scope === 'keys') {
  await listKeys();
} else if (scope === 'revoke') {
  await revokeKey(channels[0] || DEV_KID);
} else if (eddsa) {
  await mintEdDSA(claims);
} else {
  mintHS256(claims);
}

// --- HS256 (legacy) ---

function mintHS256(claims) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');

  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  console.log(`${header}.${payload}.${sig}`);
}

// --- EdDSA ---

async function mintEdDSA(claims) {
  const { privateJwk, publicJwk } = await loadOrCreateKeypair();

  // Register the public key with the local server (idempotent — 409 is fine)
  await registerKey(publicJwk);

  // Sign the token
  const header = Buffer.from(
    JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: DEV_KID }),
  ).toString('base64url');

  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const message = `${header}.${payload}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'Ed25519' },
    false,
    ['sign'],
  );

  const sigBuf = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(message),
  );

  const sig = Buffer.from(sigBuf).toString('base64url');
  console.log(`${message}.${sig}`);
}

async function loadOrCreateKeypair() {
  if (existsSync(DEV_KEYPAIR_PATH)) {
    const data = JSON.parse(readFileSync(DEV_KEYPAIR_PATH, 'utf-8'));
    return data;
  }

  console.error('Generating dev Ed25519 keypair...');
  const keypair = await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ]);
  const privateJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);

  writeFileSync(
    DEV_KEYPAIR_PATH,
    JSON.stringify({ privateJwk, publicJwk }, null, 2) + '\n',
  );
  console.error(`Saved to ${DEV_KEYPAIR_PATH}`);

  return { privateJwk, publicJwk };
}

function mintAdminHS256() {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ scope: 'admin', iat: Math.floor(Date.now() / 1000) }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function listKeys() {
  const adminToken = mintAdminHS256();
  try {
    const res = await fetch(`${LOCAL_SERVER}/api/v1/keys`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json();
    if (body.keys.length === 0) {
      console.log('No trusted keys registered.');
      return;
    }
    console.log(
      'kid'.padEnd(16) +
        'issuer'.padEnd(14) +
        'max_scope'.padEnd(12) +
        'created_at',
    );
    console.log('-'.repeat(56));
    for (const k of body.keys) {
      console.log(
        (k.kid || '').padEnd(16) +
          (k.issuer || '-').padEnd(14) +
          (k.max_scope || 'admin').padEnd(12) +
          (k.created_at || ''),
      );
    }
  } catch (e) {
    console.error(`Error: cannot reach ${LOCAL_SERVER} — ${e.message}`);
    process.exit(1);
  }
}

async function revokeKey(kid) {
  const adminToken = mintAdminHS256();
  try {
    const res = await fetch(`${LOCAL_SERVER}/api/v1/keys/${kid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 200) {
      console.log(
        `Revoked key "${kid}". Tokens signed by this key will be rejected.`,
      );
    } else if (res.status === 404) {
      console.error(`Key "${kid}" not found.`);
      process.exit(1);
    } else {
      const body = await res.text();
      console.error(`Failed (${res.status}): ${body}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error: cannot reach ${LOCAL_SERVER} — ${e.message}`);
    process.exit(1);
  }
}

async function registerKey(publicJwk) {
  const adminToken = mintAdminHS256();

  try {
    const res = await fetch(`${LOCAL_SERVER}/api/v1/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kid: DEV_KID,
        x: publicJwk.x,
        issuer: 'dev',
      }),
    });

    if (res.status === 201) {
      console.error(`Registered dev key "${DEV_KID}" with local server`);
    } else if (res.status === 409) {
      // Already registered — fine
    } else {
      const body = await res.text();
      console.error(`Warning: failed to register key (${res.status}): ${body}`);
      console.error('Is wrangler dev running on localhost:8787?');
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error: cannot reach ${LOCAL_SERVER} — ${e.message}`);
    console.error(
      'Start the dev server first: pnpm --filter @zooid/server dev',
    );
    process.exit(1);
  }
}
