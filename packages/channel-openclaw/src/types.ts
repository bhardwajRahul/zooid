import type { TokenClaims, ChannelListItem } from '@zooid/sdk';

export type { TokenClaims, ChannelListItem };

/**
 * Resolved Zooid account from OpenClaw config at `channels.zooid`.
 */
export interface ResolvedZooidAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  serverUrl: string;
  token: string;
  tokenSource: 'config' | 'env' | 'none';
  /** OAuth client_id for M2M auth (alternative to token). */
  clientId?: string;
  /** OAuth client_secret for M2M auth (alternative to token). */
  clientSecret?: string;
  /** Default channel to publish to when no target is specified. */
  defaultPublishChannel?: string;
  /** Subscribe transport mode. */
  subscribeMode?: 'auto' | 'ws' | 'poll';
  /** Poll interval in ms (when using poll transport). */
  pollInterval?: number;
}

/**
 * Zooid config section within OpenClaw's `channels.zooid`.
 */
export interface ZooidChannelConfig {
  enabled?: boolean;
  name?: string;
  serverUrl?: string;
  token?: string;
  tokenFile?: string;
  /** OAuth client_id for M2M auth (alternative to token). */
  clientId?: string;
  /** OAuth client_secret for M2M auth (alternative to token). */
  clientSecret?: string;
  defaultPublishChannel?: string;
  subscribeMode?: 'auto' | 'ws' | 'poll';
  pollInterval?: number;
  accounts?: Record<string, ZooidChannelConfig>;
}

/**
 * Probe result from health-checking a Zooid server.
 */
export interface ZooidProbe {
  ok: boolean;
  serverUrl: string;
  claims?: TokenClaims;
  channels?: ChannelListItem[];
  elapsedMs: number;
  error?: string;
}
