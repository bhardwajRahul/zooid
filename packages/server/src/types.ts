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
  ZOOID_TOKEN_EXPIRY?: string;
  ZOOID_POLL_INTERVAL?: string;
}

export interface ZooidJWT {
  scope: 'admin' | 'publish' | 'subscribe';
  channel?: string; // Legacy single-channel claim (backward compat)
  channels?: string[]; // Multi-channel claim (preferred)
  sub?: string; // Publisher ID (standard JWT subject claim)
  name?: string; // Display name (used for auto-registering publishers)
  iat: number;
  exp?: number;
}

/** Raw DB row — is_public and strict are stored as INTEGER (0/1) */
export interface Channel {
  id: string;
  name: string;
  description: string | null;
  tags: string | null;
  is_public: number;
  config: string | null;
  strict: number;
  max_subscribers: number;
  created_at: string;
}

/** Raw DB row from the trusted_keys table. */
export interface TrustedKeyRow {
  kid: string;
  kty: string;
  crv: string;
  x: string;
  max_scope: string | null;
  allowed_channels: string | null; // JSON array, null = unrestricted
  issuer: string | null;
  created_at: string;
}

export interface Variables {
  jwtPayload: ZooidJWT;
  jwtKid?: string;
  jwtIssuer?: string;
  channelIsPublic?: boolean;
}
