#!/usr/bin/env node
/**
 * Generate a JWT token for local development.
 *
 * Usage:
 *   node scripts/dev-token.mjs subscribe agent-logs
 *   node scripts/dev-token.mjs admin
 *   node scripts/dev-token.mjs publish daily-haiku
 */

import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [scope, channel] = process.argv.slice(2);

if (!scope || !['admin', 'subscribe', 'publish'].includes(scope)) {
  console.error(
    'Usage: node scripts/dev-token.mjs <admin|subscribe|publish> [channel-id]',
  );
  process.exit(1);
}

if (scope !== 'admin' && !channel) {
  console.error(`Error: ${scope} scope requires a channel ID`);
  console.error(`Usage: node scripts/dev-token.mjs ${scope} <channel-id>`);
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

// Build JWT
const header = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
).toString('base64url');

const claims = { scope, iat: Math.floor(Date.now() / 1000) };
if (channel) claims.channel = channel;

const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
const sig = createHmac('sha256', secret)
  .update(`${header}.${payload}`)
  .digest('base64url');
const token = `${header}.${payload}.${sig}`;

console.log(token);
