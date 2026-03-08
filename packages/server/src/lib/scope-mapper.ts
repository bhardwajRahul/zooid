import type { Bindings } from '../types';

/**
 * Three-tier scope resolution for OIDC-authenticated users:
 *
 * 1. `zooid:scopes` custom claim — if the OIDC token has this claim,
 *    use it directly (e.g. ["admin"] or ["pub:my-channel", "sub:*"])
 *
 * 2. `ZOOID_SCOPE_MAPPING` env var — JSON map of OIDC role → Zooid scopes
 *    e.g. { "editor": ["pub:*"], "viewer": ["sub:*"], "admin": ["admin"] }
 *    Matched against the `roles` array from the OIDC userinfo/token.
 *
 * 3. Default — ["pub:*", "sub:*"] (publish and subscribe to all channels)
 *
 * All resolved scopes are capped by `ZOOID_AUTH_MAX_SCOPES` if configured.
 */

const DEFAULT_SCOPES = ['pub:*', 'sub:*'];

export interface OIDCClaims {
  sub: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  'zooid:scopes'?: string[];
  [key: string]: unknown;
}

export interface ResolvedAuth {
  scopes: string[];
  sub: string;
  name?: string;
}

export function resolveScopes(
  claims: OIDCClaims,
  env: Pick<Bindings, 'ZOOID_SCOPE_MAPPING' | 'ZOOID_AUTH_MAX_SCOPES'>,
): ResolvedAuth {
  let scopes: string[];

  // Tier 1: explicit zooid:scopes claim
  const zooidScopes = claims['zooid:scopes'];
  if (Array.isArray(zooidScopes) && zooidScopes.length > 0) {
    scopes = zooidScopes;
  }
  // Tier 2: role mapping from env
  else if (env.ZOOID_SCOPE_MAPPING && claims.roles?.length) {
    const mapping = JSON.parse(env.ZOOID_SCOPE_MAPPING) as Record<
      string,
      string[]
    >;
    const mapped = new Set<string>();
    for (const role of claims.roles) {
      const roleScopes = mapping[role];
      if (roleScopes) {
        for (const s of roleScopes) mapped.add(s);
      }
    }
    scopes = mapped.size > 0 ? [...mapped] : DEFAULT_SCOPES;
  }
  // Tier 3: default
  else {
    scopes = DEFAULT_SCOPES;
  }

  // Enforce ceiling
  if (env.ZOOID_AUTH_MAX_SCOPES) {
    const ceiling = JSON.parse(env.ZOOID_AUTH_MAX_SCOPES) as string[];
    scopes = capScopes(scopes, ceiling);
  }

  return {
    scopes,
    sub: claims.sub,
    name: claims.name || claims.preferred_username || claims.email || undefined,
  };
}

/**
 * Filter scopes to only those allowed by the ceiling patterns.
 * Uses the same pattern matching as enforceScopeCeiling but filters
 * instead of throwing.
 */
function capScopes(scopes: string[], ceiling: string[]): string[] {
  return scopes.filter((scope) =>
    ceiling.some((pattern) => scopeAllowedBy(scope, pattern)),
  );
}

function scopeAllowedBy(scope: string, pattern: string): boolean {
  if (pattern === scope) return true;
  if (pattern === 'admin') return true;

  const [scopePrefix, scopeChannel] = splitAt(scope, ':');
  const [patternPrefix, patternChannel] = splitAt(pattern, ':');

  if (scopePrefix !== patternPrefix) return false;
  if (!patternChannel || !scopeChannel) return false;
  if (patternChannel === '*') return true;
  if (patternChannel.endsWith('*')) {
    return scopeChannel.startsWith(patternChannel.slice(0, -1));
  }
  return false;
}

function splitAt(str: string, sep: string): [string, string | undefined] {
  const idx = str.indexOf(sep);
  if (idx === -1) return [str, undefined];
  return [str.slice(0, idx), str.slice(idx + 1)];
}
