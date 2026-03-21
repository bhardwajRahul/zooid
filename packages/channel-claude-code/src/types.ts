/**
 * Auth: either a static JWT token OR client credentials (id + secret).
 * Client credentials are passed directly to ZooidClient which handles
 * the OAuth client_credentials exchange and auto-refresh internally.
 * tokenEndpoint is optional — the SDK auto-detects it for *.zoon.eco
 * servers via /.well-known/zooid.json. Only needed for self-hosted
 * servers with custom OIDC.
 */
export type ChannelAuth =
  | { mode: 'token'; token: string }
  | {
      mode: 'client_credentials';
      clientId: string;
      clientSecret: string;
      tokenEndpoint?: string;
    };

export interface ChannelConfig {
  server: string;
  auth: ChannelAuth;
  channel: string;
  transport: 'auto' | 'ws' | 'poll';
  pollInterval: number;
}

export interface ChannelNotification {
  content: string;
  meta: Record<string, string>;
}
