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
  ZOOID_STORAGE_BACKEND?: string; // "do" (default) or "d1"
  // OIDC auth proxy
  ZOOID_AUTH_URL?: string;
  ZOOID_OIDC_ISSUER?: string;
  ZOOID_OIDC_CLIENT_ID?: string;
  ZOOID_OIDC_CLIENT_SECRET?: string;
  ZOOID_AUTH_MAX_SCOPES?: string;
  ZOOID_SCOPE_MAPPING?: string;
}

// Auth types from @zooid/auth
export type { ZooidJWT, TrustedKeyRow } from '@zooid/auth';
// Re-import for local use in this file
import type { ZooidJWT } from '@zooid/auth';

/** Raw DB row — is_public is stored as INTEGER (0/1) */
export interface Channel {
  id: string;
  name: string;
  description: string | null;
  tags: string | null;
  is_public: number;
  config: string | null;
  meta: string | null;
  max_subscribers: number;
  created_at: string;
}

import type {
  ChannelBackend,
  ChannelStorage,
  RealtimeBroadcast,
  ChannelContext,
} from './storage/types';
import type { ServerStorage } from './storage/server-types';

export interface Variables {
  jwtPayload: ZooidJWT;
  jwtKid?: string;
  jwtIssuer?: string;
  channelIsPublic?: boolean;
  channelBackend?: ChannelBackend;
  channelStorage?: ChannelStorage;
  realtimeBroadcast?: RealtimeBroadcast;
  channelCtx?: ChannelContext;
  serverStorage?: ServerStorage;
}
