import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables, ZooidJWT } from '../types';
import type { ChannelContext } from '../storage/types';
import { getChannel, getRetentionDays } from '../db/queries';
import {
  verifyTokenAny,
  normalizeScopes,
  isAdmin,
  canPublish,
  canSubscribe,
} from '../lib/jwt';

type Env = { Bindings: Bindings; Variables: Variables };

export function requireAuth() {
  return createMiddleware<Env>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    try {
      const { payload, kid, issuer } = await verifyTokenAny(token, c.env);
      c.set('jwtPayload', payload);
      if (kid) c.set('jwtKid', kid);
      if (issuer) c.set('jwtIssuer', issuer);
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    await next();
  });
}

export function requireScope(
  scope: string,
  options?: { channelParam?: string },
) {
  return createMiddleware<Env>(async (c, next) => {
    const payload = c.get('jwtPayload') as ZooidJWT;
    const scopes = normalizeScopes(payload);

    // Admin can do anything
    if (isAdmin(scopes)) {
      await next();
      return;
    }

    if (scope === 'admin') {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    if (scope === 'publish' && options?.channelParam) {
      const channelId = c.req.param(options.channelParam)!;
      if (!canPublish(scopes, channelId)) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
      await next();
      return;
    }

    if (scope === 'subscribe' && options?.channelParam) {
      const channelId = c.req.param(options.channelParam)!;
      if (!canSubscribe(scopes, channelId)) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
      await next();
      return;
    }

    // Generic scope check (for legacy callers)
    // Map legacy scope names to new format
    const required =
      scope === 'publish' ? 'pub:*' : scope === 'subscribe' ? 'sub:*' : scope;
    const hasIt = scopes.some(
      (s) =>
        s === required ||
        s.startsWith(
          scope === 'publish' ? 'pub:' : scope === 'subscribe' ? 'sub:' : '',
        ),
    );
    if (!hasIt) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    await next();
  });
}

/**
 * Optionally extracts JWT payload if an Authorization header is present.
 * Does NOT reject unauthenticated requests — just sets jwtPayload if valid.
 */
export function optionalAuth() {
  return createMiddleware<Env>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { payload, kid, issuer } = await verifyTokenAny(
          authHeader.slice(7),
          c.env,
        );
        c.set('jwtPayload', payload);
        if (kid) c.set('jwtKid', kid);
        if (issuer) c.set('jwtIssuer', issuer);
      } catch {
        // Invalid token — treat as unauthenticated
      }
    }
    await next();
  });
}

export function requireSubscribeIfPrivate(channelParam: string) {
  return createMiddleware<Env>(async (c, next) => {
    const channelId = c.req.param(channelParam)!;
    const db = c.env.DB;

    // Load full channel row (not just is_public) so we can set up storage context
    const channel = await getChannel(db, channelId);

    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404);
    }

    // Set up storage context if backend is available
    const backend = c.get('channelBackend');
    if (backend && !c.get('channelStorage')) {
      const ctx: ChannelContext = {
        channel_id: channelId,
        channel,
        is_public: channel.is_public === 1,
        retention_days: getRetentionDays(channel),
        signing_key: c.env.ZOOID_SIGNING_KEY,
        server_url: new URL(c.req.url).origin,
        server_id: c.env.ZOOID_SERVER_ID,
      };
      const { storage, realtime } = backend.getChannel(ctx);
      c.set('channelStorage', storage);
      c.set('realtimeBroadcast', realtime);
      c.set('channelCtx', ctx);
    }

    if (channel.is_public === 1) {
      c.set('channelIsPublic', true);
      await next();
      return;
    }

    const authHeader = c.req.header('Authorization');
    const queryToken = c.req.query('token');
    const rawToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (queryToken ?? null);

    if (!rawToken) {
      return c.json(
        { error: 'Subscribe token required for private channel' },
        401,
      );
    }

    try {
      const { payload, kid, issuer } = await verifyTokenAny(rawToken, c.env);
      const scopes = normalizeScopes(payload);

      if (!isAdmin(scopes) && !canSubscribe(scopes, channelId)) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }

      c.set('jwtPayload', payload);
      if (kid) c.set('jwtKid', kid);
      if (issuer) c.set('jwtIssuer', issuer);
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    await next();
  });
}
