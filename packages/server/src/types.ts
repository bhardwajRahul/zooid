// Re-export shared API types
export type {
  ZooidEvent,
  PollResult,
  ChannelListItem,
  Webhook,
  ServerDiscovery,
  ServerIdentity,
} from '@zooid/types';

// Deprecated aliases for backward compatibility
export type { ServerMetadata, ServerMeta } from '@zooid/types';

// Server-internal types

import type { ChannelDO } from './do/channel';

export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  CHANNEL_DO: DurableObjectNamespace<ChannelDO>;
  ZOOID_JWT_SECRET: string;
  ZOOID_SIGNING_KEY?: string;
  ZOOID_PUBLIC_KEY?: string;
  ZOOID_SERVER_ID?: string;
  ZOOID_SERVER_NAME?: string;
  ZOOID_SERVER_DESC?: string;
  ZOOID_SERVER_URL?: string;
  ZOOID_TOKEN_EXPIRY?: string;
  ZOOID_POLL_INTERVAL?: string;
  // OIDC auth proxy
  ZOOID_AUTH_URL?: string;
  ZOOID_OIDC_ISSUER?: string;
  ZOOID_OIDC_CLIENT_ID?: string;
  ZOOID_OIDC_CLIENT_SECRET?: string;
  ZOOID_AUTH_MAX_SCOPES?: string;
  ZOOID_SCOPE_MAPPING?: string;
}

export interface ZooidJWT {
  // New multi-scope claim: ["admin", "pub:channel-id", "sub:channel-id"]
  scopes?: string[];
  // Legacy fields (backward compat — normalized to scopes on verify)
  scope?: 'admin' | 'publish' | 'subscribe';
  channel?: string;
  channels?: string[];
  sub?: string; // Publisher ID (standard JWT subject claim)
  name?: string; // Display name (used for auto-registering publishers)
  aud?: string; // Audience — the Zooid server URL this token is bound to
  iat: number;
  exp?: number;
}

/** Raw DB row — is_public is stored as INTEGER (0/1) */
export interface Channel {
  id: string;
  name: string;
  description: string | null;
  tags: string | null;
  is_public: number;
  config: string | null;
  max_subscribers: number;
  created_at: string;
}

/** Raw DB row from the trusted_keys table. */
export interface TrustedKeyRow {
  kid: string;
  kty: string;
  crv: string;
  x: string;
  max_scopes: string | null; // JSON array of scope patterns, null = unrestricted
  issuer: string | null;
  created_at: string;
}

export interface Variables {
  jwtPayload: ZooidJWT;
  jwtKid?: string;
  jwtIssuer?: string;
  channelIsPublic?: boolean;
}
