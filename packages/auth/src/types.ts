/** Zooid JWT payload — the canonical token format across all Zooid components. */
export interface ZooidJWT {
  // New multi-scope claim: ["admin", "pub:channel-id", "sub:channel-id"]
  scopes?: string[];
  // Role names — inert metadata for channel policy evaluation
  groups?: string[];
  // Legacy fields (backward compat — normalized to scopes on verify)
  scope?: 'admin' | 'publish' | 'subscribe';
  channel?: string;
  channels?: string[];
  sub?: string; // Publisher ID (standard JWT subject claim)
  name?: string; // Display name
  aud?: string; // Audience — the Zooid server URL this token is bound to
  iat: number;
  exp?: number;
}

/** Raw DB row from the trusted_keys table. */
export interface TrustedKeyRow {
  kid: string;
  kty: string;
  crv: string;
  x: string;
  max_scopes: string | null; // JSON array of scope patterns, null = unrestricted
  issuer: string | null;
  jwks_url: string | null;
  created_at: string;
}
