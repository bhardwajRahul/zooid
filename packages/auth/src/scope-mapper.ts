import { scopeMatchesPattern } from './scopes';

/**
 * Three-tier scope resolution for OIDC-authenticated users:
 *
 * 1. `https://zooid.dev/scopes` custom claim — use directly
 * 2. `ZOOID_SCOPE_MAPPING` env var — JSON map of OIDC group → Zooid scopes
 * 3. Default — ["pub:*", "sub:*"]
 *
 * All resolved scopes are capped by `maxScopes` if provided.
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

export interface ScopeResolutionEnv {
  ZOOID_SCOPE_MAPPING?: string;
  ZOOID_AUTH_MAX_SCOPES?: string;
}

export function resolveScopes(
  claims: OIDCClaims,
  env: ScopeResolutionEnv,
): ResolvedAuth {
  let scopes: string[];

  // Tier 1: explicit https://zooid.dev/scopes claim (empty array = no scopes, not a fallthrough)
  const zooidScopes = claims['https://zooid.dev/scopes'];
  if (Array.isArray(zooidScopes)) {
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
 */
function capScopes(scopes: string[], ceiling: string[]): string[] {
  const result = new Set<string>();

  const ceilingPatterns = ceiling.filter((c) => c !== 'admin');
  const ceilingHasAdmin = ceiling.includes('admin');

  for (const scope of scopes) {
    if (scope === 'admin') {
      if (ceilingHasAdmin) result.add('admin');
      continue;
    }

    if (
      ceilingPatterns.some((pattern) => scopeMatchesPattern(scope, pattern))
    ) {
      result.add(scope);
      continue;
    }

    for (const cap of ceilingPatterns) {
      if (scopeMatchesPattern(cap, scope)) {
        result.add(cap);
      }
    }
  }

  return [...result];
}
