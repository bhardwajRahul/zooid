import type { ChannelListItem, ZooidEvent, PollResult } from '@zooid/types';

export type { ChannelListItem, ZooidEvent, PollResult };

// Alias for backward compat within the web app
export type ChannelInfo = ChannelListItem;

export interface ServerMeta {
  server_name: string;
  server_description: string | null;
  poll_interval: number;
  delivery: string[];
  auth_url?: string;
}

export interface TokenClaims {
  scopes: string[];
  sub?: string;
  name?: string;
  iat: number;
  exp?: number;
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {};
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

export async function listChannels(
  baseUrl: string,
  token?: string,
): Promise<ChannelInfo[]> {
  const res = await fetch(`${baseUrl}/api/v1/channels`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  const data: { channels: ChannelInfo[] } = await res.json();
  return data.channels;
}

export async function getChannel(
  baseUrl: string,
  channelId: string,
  token?: string,
): Promise<ChannelInfo | null> {
  const res = await fetch(`${baseUrl}/api/v1/channels`, {
    headers: headers(token),
  });
  if (!res.ok) return null;
  const data: { channels: ChannelInfo[] } = await res.json();
  return data.channels.find((ch) => ch.id === channelId) ?? null;
}

const defaultMeta: ServerMeta = {
  server_name: 'Zooid',
  server_description: null,
  poll_interval: 5,
  delivery: ['poll'],
};

export async function fetchServerMeta(baseUrl: string): Promise<ServerMeta> {
  try {
    const res = await fetch(`${baseUrl}/.well-known/zooid.json`);
    if (!res.ok) return defaultMeta;
    const data = await res.json();
    return {
      server_name: data.server_name ?? 'Zooid',
      server_description: data.server_description ?? null,
      poll_interval: data.poll_interval ?? 5,
      delivery: Array.isArray(data.delivery) ? data.delivery : ['poll'],
      auth_url: data.auth_url ?? undefined,
    };
  } catch {
    return defaultMeta;
  }
}

export async function getTokenClaims(
  baseUrl: string,
  token: string,
): Promise<TokenClaims | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/tokens/claims`, {
      headers: headers(token),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function publishEvent(
  baseUrl: string,
  channelId: string,
  payload: { type?: string; data: unknown },
  token: string,
): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/v1/channels/${channelId}/events`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function refreshAuth(
  baseUrl: string,
): Promise<{ token: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function authLogout(baseUrl: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Best effort
  }
}

export async function pollEvents(
  baseUrl: string,
  channelId: string,
  options: { cursor?: string; since?: string; limit?: number; token?: string },
): Promise<PollResult> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.since) params.set('since', options.since);
  if (options.limit) params.set('limit', String(options.limit));

  const qs = params.toString();
  const url = `${baseUrl}/api/v1/channels/${channelId}/events${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: headers(options.token),
  });

  if (!res.ok) {
    return { events: [], cursor: null, has_more: false };
  }

  return res.json();
}
