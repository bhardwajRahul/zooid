export { ZooidClient } from './client';
export { ZooidError } from './error';
export { OAuthTokenManager } from './oauth';
export { verifyWebhook } from './verify';
export type { VerifyWebhookOptions } from './verify';
export type {
  ZooidClientOptions,
  ServerDiscovery,
  ServerIdentity,
  ChannelInfo,
  CreateChannelOptions,
  CreateChannelResult,
  UpdateChannelOptions,
  MintTokenOptions,
  MintTokenResult,
  ZooidEvent,
  PublishOptions,
  PollOptions,
  PollResult,
  WebhookOptions,
  WebhookResult,
  SubscribeMode,
  SubscribeOptions,
  TailOptions,
  TailStream,
  UpdateServerMetaOptions,
  ClaimResult,
  TrustedKey,
  AddKeyOptions,
  TokenClaims,
} from './types';

// Deprecated aliases for backward compatibility
export type { ServerMetadata, ServerMeta } from './types';
