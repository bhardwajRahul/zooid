import type { ZooidJWT } from './types';

/**
 * Normalize legacy JWT claims to the new `scopes` array format.
 *
 * Legacy: { scope: "admin" } → ["admin"]
 * Legacy: { scope: "publish", channels: ["foo"] } → ["pub:foo"]
 * Legacy: { scope: "subscribe", channel: "bar" } → ["sub:bar"]
 * New:    { scopes: ["pub:foo", "sub:bar"] } → as-is
 */
export function normalizeScopes(payload: ZooidJWT): string[] {
  if (payload.scopes) return payload.scopes;

  const scope = payload.scope;
  if (!scope) return [];

  if (scope === 'admin') return ['admin'];

  const prefix = scope === 'publish' ? 'pub' : 'sub';
  const channels =
    payload.channels ?? (payload.channel ? [payload.channel] : []);

  if (channels.length === 0) return [`${prefix}:*`];
  return channels.map((ch) => `${prefix}:${ch}`);
}

/**
 * Check if a scope string matches a pattern.
 * Patterns: "admin", "pub:exact", "pub:prefix-*", "pub:*"
 */
export function scopeMatchesPattern(scope: string, pattern: string): boolean {
  if (pattern === scope) return true;
  if (pattern === 'admin') return true;

  const [scopePrefix, scopeChannel] = splitScope(scope);
  const [patternPrefix, patternChannel] = splitScope(pattern);

  if (scopePrefix !== patternPrefix) return false;
  if (!patternChannel || !scopeChannel) return false;
  if (patternChannel === '*') return true;

  if (patternChannel.endsWith('*')) {
    const prefix = patternChannel.slice(0, -1);
    return scopeChannel.startsWith(prefix);
  }

  return false;
}

/** Split "pub:channel-id" into ["pub", "channel-id"]. "admin" → ["admin", undefined] */
function splitScope(scope: string): [string, string | undefined] {
  const idx = scope.indexOf(':');
  if (idx === -1) return [scope, undefined];
  return [scope.slice(0, idx), scope.slice(idx + 1)];
}

/**
 * Check if a token's scopes include a required scope.
 * "admin" in scopes grants everything.
 */
export function hasScope(scopes: string[], required: string): boolean {
  return scopes.some((s) => s === 'admin' || scopeMatchesPattern(required, s));
}

export function canPublish(scopes: string[], channelId: string): boolean {
  return hasScope(scopes, `pub:${channelId}`);
}

export function canSubscribe(scopes: string[], channelId: string): boolean {
  return hasScope(scopes, `sub:${channelId}`);
}

export function isAdmin(scopes: string[]): boolean {
  return scopes.includes('admin');
}

/**
 * Enforce a max_scopes ceiling on a set of token scopes.
 * Each token scope must be allowed by at least one ceiling pattern.
 * null ceiling = unrestricted.
 */
export function enforceScopeCeiling(
  scopes: string[],
  maxScopes: string[] | null,
): void {
  if (!maxScopes) return;

  for (const scope of scopes) {
    const allowed = maxScopes.some((pattern) =>
      scopeMatchesPattern(scope, pattern),
    );
    if (!allowed) {
      throw new Error(`Scope "${scope}" exceeds key ceiling`);
    }
  }
}
