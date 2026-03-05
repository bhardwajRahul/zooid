import { ZooidClient } from '@zooid/sdk';
import { loadConfig, loadConfigFile, saveConfig } from './config';

export function createClient(token?: string): ZooidClient {
  const config = loadConfig();
  const server = config.server;

  if (!server) {
    throw new Error(
      'No server configured. Run: npx zooid config set server <url>',
    );
  }

  return new ZooidClient({ server, token: token ?? config.admin_token });
}

/** Resolve a channel token from config, checking new `token` field then legacy fields. */
function getChannelToken(
  channelTokens:
    | { token?: string; publish_token?: string; subscribe_token?: string }
    | undefined,
  tokenType?: 'publish' | 'subscribe',
): string | undefined {
  if (!channelTokens) return undefined;
  // New unified token
  if (channelTokens.token) return channelTokens.token;
  // Legacy fallback
  if (tokenType === 'publish') return channelTokens.publish_token;
  if (tokenType === 'subscribe') return channelTokens.subscribe_token;
  return channelTokens.publish_token ?? channelTokens.subscribe_token;
}

export function createChannelClient(
  channelId: string,
  tokenType: 'publish' | 'subscribe',
): ZooidClient {
  const config = loadConfig();
  const server = config.server;

  if (!server) {
    throw new Error(
      'No server configured. Run: npx zooid config set server <url>',
    );
  }

  const channelToken = getChannelToken(config.channels?.[channelId], tokenType);
  return new ZooidClient({ server, token: channelToken ?? config.admin_token });
}

/** @deprecated Use createChannelClient(channelId, 'publish') */
export const createPublishClient = (channelId: string) =>
  createChannelClient(channelId, 'publish');

/** @deprecated Use createChannelClient(channelId, 'subscribe') */
export const createSubscribeClient = (channelId: string) =>
  createChannelClient(channelId, 'subscribe');

/**
 * Parse a channel argument that may be a full URL or a plain channel ID.
 * Accepts both formats:
 *   https://server.dev/my-channel           → { server, channelId: "my-channel" }
 *   https://server.dev/channels/my-channel  → { server, channelId: "my-channel" }
 */
/** Matches localhost and private/reserved IP ranges (127.x, 10.x, 192.168.x, 172.16-31.x). */
export const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/** Normalize a server URL: upgrade http→https (except localhost/private IPs), strip trailing slashes. */
export function normalizeServerUrl(url: string): string {
  let normalized = url.replace(/\/+$/, '');
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' && !PRIVATE_HOST_RE.test(parsed.hostname)) {
      normalized = normalized.replace(/^http:\/\//, 'https://');
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return normalized;
}

export function parseChannelUrl(
  channel: string,
): { server: string; channelId: string } | null {
  // Add protocol if it looks like a URL (domain with dot, or host:port)
  let raw = channel;
  if (!raw.startsWith('http') && raw.includes('/')) {
    if (PRIVATE_HOST_RE.test(raw.split(/[:/]/)[0])) {
      raw = `http://${raw}`;
    } else if (raw.includes('.')) {
      raw = `https://${raw}`;
    } else if (/^[^/]+:\d+\//.test(raw)) {
      // other host:port/channel — assume http for bare ports
      raw = `http://${raw}`;
    }
  }
  if (!raw.startsWith('http')) return null;
  try {
    const url = new URL(raw);
    // /channels/<id> format
    const channelsMatch = url.pathname.match(/^\/channels\/([^/]+)/);
    if (channelsMatch) {
      return { server: url.origin, channelId: channelsMatch[1] };
    }
    // Simple /<id> format (single path segment)
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 1) {
      return { server: url.origin, channelId: segments[0] };
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

export interface ResolveChannelResult {
  client: ZooidClient;
  channelId: string;
  server: string;
  /** True if the token was newly saved to config. */
  tokenSaved: boolean;
}

/**
 * Resolve a channel argument (URL or plain ID) + optional token into a client.
 * When --token is explicitly provided, it's saved to config for future use.
 * On subsequent calls without --token, the saved token is used automatically.
 */
export function resolveChannel(
  channel: string,
  opts?: { token?: string; tokenType?: 'publish' | 'subscribe' },
): ResolveChannelResult {
  const parsed = parseChannelUrl(channel);

  if (parsed) {
    // Remote server URL
    const { server, channelId } = parsed;
    let token = opts?.token;
    let tokenSaved = false;

    // Save explicit token for future use
    if (token) {
      saveConfig({ channels: { [channelId]: { token } } }, server, {
        setCurrent: false,
      });
      tokenSaved = true;
    }

    // Look up saved token if none provided
    if (!token) {
      const file = loadConfigFile();
      const channelTokens = file.servers?.[server]?.channels?.[channelId];
      token = getChannelToken(channelTokens, opts?.tokenType);
    }

    return {
      client: new ZooidClient({ server, token }),
      channelId,
      server,
      tokenSaved,
    };
  }

  // Plain channel ID — use current server
  const config = loadConfig();
  const server = config.server;
  if (!server) {
    throw new Error(
      'No server configured. Run: npx zooid config set server <url>',
    );
  }

  let token = opts?.token;
  let tokenSaved = false;

  // Save explicit token for future use
  if (token) {
    saveConfig({ channels: { [channel]: { token } } });
    tokenSaved = true;
  }

  // Look up token from config if none provided
  if (!token) {
    const channelToken = getChannelToken(
      config.channels?.[channel],
      opts?.tokenType,
    );
    token = channelToken ?? config.admin_token;
  }

  return {
    client: new ZooidClient({ server, token }),
    channelId: channel,
    server,
    tokenSaved,
  };
}
