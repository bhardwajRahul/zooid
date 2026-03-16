import type { Bindings } from '../types';
import { scopeMatchesPattern } from './jwt';

/**
 * Three-tier scope resolution for OIDC-authenticated users:
 *
 * 1. `https://zooid.dev/scopes` custom claim — if the OIDC token has this claim,
 *    use it directly (e.g. ["admin"] or ["pub:my-channel", "sub:*"])
 *
 * 2. `ZOOID_SCOPE_MAPPING` env var — JSON map of OIDC group → Zooid scopes
 *    e.g. { "editor": ["pub:*"], "viewer": ["sub:*"], "admin": ["admin"] }
 *    Matched against the `groups` array from the OIDC userinfo/token.
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
  groups?: string[];
  'https://zooid.dev/scopes'?: string[];
  [key: string]: unknown;
}

export interface ResolvedAuth {
  scopes: string[];
  sub: string;
  name?: string;
  groups?: string[];
}

export function resolveScopes(
  claims: OIDCClaims,
  env: Pick<Bindings, 'ZOOID_SCOPE_MAPPING' | 'ZOOID_AUTH_MAX_SCOPES'>,
): ResolvedAuth {
  let scopes: string[];

  // Tier 1: explicit https://zooid.dev/scopes claim
  const zooidScopes = claims['https://zooid.dev/scopes'];
  if (Array.isArray(zooidScopes) && zooidScopes.length > 0) {
    scopes = zooidScopes;
  }
  // Tier 2: group mapping from env
  else if (env.ZOOID_SCOPE_MAPPING && claims.groups?.length) {
    const mapping = JSON.parse(env.ZOOID_SCOPE_MAPPING) as Record<
      string,
      string[]
    >;
    const mapped = new Set<string>();
    for (const group of claims.groups) {
      const roleScopes = mapping[group];
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
    groups: claims.groups?.length ? claims.groups : undefined,
  };
}

/**
 * Intersect scopes with a ceiling.
 * - If a scope exactly matches or is covered by a ceiling pattern, keep it.
 * - If a scope is a wildcard (e.g. pub:*) and the ceiling has specific entries
 *   (e.g. pub:public-chatter), narrow it to those ceiling entries.
 */
function capScopes(scopes: string[], ceiling: string[]): string[] {
  const result = new Set<string>();

  // Filter out "admin" for pattern matching — it has special match-all
  // semantics in scopeMatchesPattern that would bypass the ceiling.
  // Handle it as a literal: only pass "admin" scope if "admin" is in ceiling.
  const ceilingPatterns = ceiling.filter((c) => c !== 'admin');
  const ceilingHasAdmin = ceiling.includes('admin');

  for (const scope of scopes) {
    if (scope === 'admin') {
      if (ceilingHasAdmin) result.add('admin');
      continue;
    }

    // Scope is directly allowed by a ceiling pattern
    if (
      ceilingPatterns.some((pattern) => scopeMatchesPattern(scope, pattern))
    ) {
      result.add(scope);
      continue;
    }

    // Scope is a wildcard — expand to matching ceiling entries
    for (const cap of ceilingPatterns) {
      if (scopeMatchesPattern(cap, scope)) {
        result.add(cap);
      }
    }
  }

  return [...result];
}
