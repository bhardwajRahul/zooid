import { ZooidClient } from '@zooid/sdk';

export type {
  ChannelInfo,
  ServerIdentity,
  TrustedKey,
  TokenClaims,
  ZooidEvent,
  PollResult,
} from '@zooid/sdk';

export interface ServerMeta {
  server_name: string;
  server_description: string | null;
  poll_interval: number;
  delivery: string[];
  auth_url?: string;
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

/** Create a ZooidClient bound to the current origin. */
export function createClient(token?: string): ZooidClient {
  return new ZooidClient({
    server: window.location.origin,
    token,
  });
}

// BFF auth endpoints (not in SDK — they use cookies/credentials)

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
