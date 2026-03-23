import type { Channel, TrustedKeyRow, ServerIdentity } from '../types';
import type { ChannelListItem } from '@zooid/types';

/** Input for creating a channel. */
export interface CreateChannelInput {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
  config?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/** Fields that can be updated on a channel. All optional. */
export interface UpdateChannelInput {
  name?: string;
  description?: string | null;
  tags?: string[] | null;
  is_public?: boolean;
  config?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}

/** Input for adding a trusted key. */
export interface AddTrustedKeyInput {
  kid: string;
  x?: string;
  max_scopes?: string[] | null;
  issuer?: string | null;
  jwks_url?: string | null;
  kty?: string;
  crv?: string;
}

/**
 * ServerStorage is the control plane interface.
 * Route handlers call this for channel registry, server config,
 * and trusted keys. They never query D1 directly.
 *
 * Single-tenant (self-hosted): no scoping, owns the whole DB.
 * Multi-tenant (zoon): every query scoped by server_id.
 */
export interface ServerStorage {
  // ── Channels ────────────────────────────────────────────
  createChannel(input: CreateChannelInput): Promise<Channel>;
  getChannel(channelId: string): Promise<Channel | null>;
  listChannels(): Promise<ChannelListItem[]>;
  updateChannel(
    channelId: string,
    input: UpdateChannelInput,
  ): Promise<Channel | null>;
  patchChannelMeta(
    channelId: string,
    patch: Record<string, unknown>,
  ): Promise<Channel | null>;
  deleteChannel(channelId: string): Promise<boolean>;
  updateChannelStats(
    channelId: string,
    eventCount: number,
    lastEventId: string,
  ): Promise<void>;

  // ── Server Metadata ─────────────────────────────────────
  getServerMeta(): Promise<ServerIdentity | null>;
  upsertServerMeta(meta: {
    name?: string;
    description?: string | null;
    tags?: string[];
    owner?: string | null;
    company?: string | null;
    email?: string | null;
  }): Promise<ServerIdentity>;

  // ── Trusted Keys ────────────────────────────────────────
  listTrustedKeys(): Promise<TrustedKeyRow[]>;
  getTrustedKey(kid: string): Promise<TrustedKeyRow | null>;
  addTrustedKey(input: AddTrustedKeyInput): Promise<TrustedKeyRow>;
  removeTrustedKey(kid: string): Promise<boolean>;
}
