import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import {
  listTrustedKeys,
  getTrustedKey,
  addTrustedKey,
  removeTrustedKey,
} from '../db/queries';

type Env = { Bindings: Bindings; Variables: Variables };

const keys = new Hono<Env>();

// GET /keys — list all trusted keys
keys.get('/keys', async (c) => {
  const rows = await listTrustedKeys(c.env.DB);
  return c.json({
    keys: rows.map((r) => ({
      kid: r.kid,
      kty: r.kty,
      crv: r.crv,
      x: r.x,
      max_scope: r.max_scope,
      allowed_channels: r.allowed_channels
        ? JSON.parse(r.allowed_channels)
        : null,
      issuer: r.issuer,
      created_at: r.created_at,
    })),
  });
});

// POST /keys — add a trusted key
keys.post('/keys', async (c) => {
  const body = await c.req.json<{
    kid: string;
    x: string;
    max_scope?: string;
    allowed_channels?: string[];
    issuer?: string;
    kty?: string;
    crv?: string;
  }>();

  if (!body.kid || !body.x) {
    return c.json({ error: 'kid and x (public key) are required' }, 400);
  }

  if (
    body.max_scope &&
    !['subscribe', 'publish', 'admin'].includes(body.max_scope)
  ) {
    return c.json(
      { error: 'max_scope must be subscribe, publish, or admin' },
      400,
    );
  }

  if (
    body.allowed_channels &&
    (!Array.isArray(body.allowed_channels) ||
      !body.allowed_channels.every((ch) => typeof ch === 'string'))
  ) {
    return c.json(
      { error: 'allowed_channels must be an array of strings' },
      400,
    );
  }

  const existing = await getTrustedKey(c.env.DB, body.kid);
  if (existing) {
    return c.json({ error: `Key "${body.kid}" already exists` }, 409);
  }

  try {
    const key = await addTrustedKey(c.env.DB, body);
    return c.json(
      {
        ...key,
        allowed_channels: key.allowed_channels
          ? JSON.parse(key.allowed_channels)
          : null,
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add key';
    return c.json({ error: message }, 400);
  }
});

// DELETE /keys/:kid — revoke a trusted key
keys.delete('/keys/:kid', async (c) => {
  const targetKid = c.req.param('kid');
  const callerKid = c.get('jwtKid');

  // Self-revocation guard
  if (callerKid && targetKid === callerKid) {
    return c.json(
      { error: 'Cannot revoke the key that signed this request' },
      403,
    );
  }

  const deleted = await removeTrustedKey(c.env.DB, targetKid);
  if (!deleted) {
    return c.json({ error: 'Key not found' }, 404);
  }

  return c.json({ ok: true });
});

export { keys };
