// Re-export shared API types (canonical names)
export type {
  ZooidEvent,
  PollResult,
  ServerDiscovery,
  ServerIdentity,
} from '@zooid/types';

// Deprecated aliases re-exported for backward compatibility
export type { ServerMetadata, ServerMeta } from '@zooid/types';

import type {
  ZooidEvent as ZooidEventType,
  ChannelListItem,
  Webhook,
} from '@zooid/types';

// Local alias so we can reference ZooidEvent in interface definitions
// while still re-exporting it above.
type ZooidEvent = ZooidEventType;

/** Channel info as returned by `GET /api/v1/channels`. Alias for {@link ChannelListItem}. */
export type ChannelInfo = ChannelListItem;

/** Webhook registration result. Alias for {@link Webhook}. */
export type WebhookResult = Webhook;

// SDK-specific types

/** Options for constructing a {@link ZooidClient}. */
export interface ZooidClientOptions {
  /** Base URL of the Zooid server (e.g. `"https://zooid.example.workers.dev"`). */
  server: string;
  /** JWT token (admin, publish, or subscribe scoped). Mutually exclusive with `clientId`. */
  token?: string;
  /** OAuth client ID for client_credentials flow. Mutually exclusive with `token`. */
  clientId?: string;
  /** OAuth client secret for client_credentials flow. Required when `clientId` is set. */
  clientSecret?: string;
  /** Override token endpoint URL. If omitted, auto-discovered from server's `/.well-known/zooid.json`. */
  tokenEndpoint?: string;
  /** Custom fetch implementation (for testing or custom environments). */
  fetch?: typeof globalThis.fetch;
}

/** Options for creating a new channel via `POST /api/v1/channels`. */
export interface CreateChannelOptions {
  /** URL-safe slug identifier (lowercase + hyphens, 3-64 chars). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional channel description. */
  description?: string;
  /** Whether the channel is publicly accessible. Defaults to `true`. */
  is_public?: boolean;
  /** Optional channel config (types, policies, storage, strict_types). */
  config?: Record<string, unknown>;
  /** Optional channel meta (display, runtime state). */
  meta?: Record<string, unknown>;
}

/** Options for updating an existing channel via `PATCH /api/v1/channels/:id`. */
export interface UpdateChannelOptions {
  /** Human-readable display name. */
  name?: string;
  /** Channel description (set to `null` to clear). */
  description?: string | null;
  /** Tags for categorization (set to `null` to clear). */
  tags?: string[] | null;
  /** Whether the channel is publicly accessible. */
  is_public?: boolean;
  /** Channel config (set to `null` to clear). */
  config?: Record<string, unknown> | null;
  /** Channel meta (set to `null` to clear). */
  meta?: Record<string, unknown> | null;
}

/** Result of creating a new channel. */
export interface CreateChannelResult {
  /** The channel's slug identifier. */
  id: string;
  /** JWT token with pub+sub scopes for this channel. */
  token: string;
}

/** Options for minting a new token via `POST /api/v1/tokens`. */
export interface MintTokenOptions {
  /** Scopes: ["admin"], ["pub:channel-id", "sub:channel-id"], etc. */
  scopes: string[];
  /** Subject identifier (e.g. publisher ID). */
  sub?: string;
  /** Display name (used for publisher identity). */
  name?: string;
  /** Token expiry duration (e.g. `"5m"`, `"1h"`, `"7d"`, `"30d"`). */
  expires_in?: string;
  /** Role names — inert metadata for channel policy evaluation. */
  groups?: string[];
}

/** Result of minting a token. */
export interface MintTokenResult {
  /** The signed JWT string. */
  token: string;
}

/** Options for publishing a single event. */
export interface PublishOptions {
  /** Optional event type string for subscriber filtering. */
  type?: string;
  /** ULID of the parent event to reply to. */
  reply_to?: string;
  /** Event payload (will be JSON-serialized, max 64 KB). */
  data: unknown;
  /** Optional presentation directives (arbitrary JSON object). */
  meta?: Record<string, unknown>;
}

/** Options for polling events from a channel. */
export interface PollOptions {
  /** Opaque cursor from a previous poll response. */
  cursor?: string;
  /** ISO 8601 timestamp — only return events created after this time. */
  since?: string;
  /** Maximum number of events to return (default: 50). */
  limit?: number;
  /** Filter events by type. */
  type?: string;
}

/** Options for registering a webhook. */
export interface WebhookOptions {
  /** Only deliver events matching these types. Omit for all events. */
  event_types?: string[];
  /** Webhook lifetime in seconds (default: 3 days, max: 30 days). */
  ttl_seconds?: number;
}

/** Subscribe transport mode. */
export type SubscribeMode = 'auto' | 'ws' | 'poll';

/** Options for the subscribe helper. */
export interface SubscribeOptions {
  /** Polling interval in milliseconds. Default: `5000`. */
  interval?: number;
  /** Transport mode. `'auto'` (default) tries WebSocket first, falls back to polling. */
  mode?: SubscribeMode;
  /** Event type filter — passed as `?types=` on WS, `?type=` on poll. */
  type?: string;
}

/** Options for the `tail()` method. Extends poll options with follow mode. */
export interface TailOptions extends PollOptions {
  /** When `true`, subscribe and stream events as they arrive. */
  follow?: boolean;
  /** Transport mode for follow mode. Default: `'auto'`. */
  mode?: SubscribeMode;
  /** Polling interval in ms for follow mode (poll transport). Default: `5000`. */
  interval?: number;
}

/**
 * An async iterable stream of events returned by `tail({ follow: true })`.
 * Call `close()` to stop the underlying subscription and end the stream.
 */
export interface TailStream extends AsyncIterable<ZooidEvent> {
  /** Stop the subscription and end the stream. */
  close(): void;
}

/** Result of generating a signed directory claim. */
export interface ClaimResult {
  /** Base64url-encoded JSON claim payload. */
  claim: string;
  /** Base64url-encoded Ed25519 signature of the claim. */
  signature: string;
}

/** A trusted signing key registered on the server. */
export interface TrustedKey {
  kid: string;
  kty: string;
  crv: string;
  x: string;
  max_scopes: string[] | null;
  issuer: string | null;
  jwks_url: string | null;
  created_at: string;
}

/** Options for adding a trusted key. */
export interface AddKeyOptions {
  kid: string;
  x?: string;
  max_scopes?: string[];
  issuer?: string;
  jwks_url?: string;
  kty?: string;
  crv?: string;
}

/** Token claims as returned by `GET /api/v1/tokens/claims`. */
export interface TokenClaims {
  scopes: string[];
  sub?: string;
  name?: string;
  iat: number;
  exp?: number;
}

/** Options for updating server identity metadata. */
export interface UpdateServerMetaOptions {
  /** Server display name. */
  name?: string;
  /** Server description (set to `null` to clear). */
  description?: string | null;
  /** Tags for categorization. */
  tags?: string[];
  /** Operator name (set to `null` to clear). */
  owner?: string | null;
  /** Company name (set to `null` to clear). */
  company?: string | null;
  /** Contact email (set to `null` to clear). */
  email?: string | null;
}
