import type { ChannelAuth, ChannelConfig } from './types.js';

const VALID_TRANSPORTS = ['auto', 'ws', 'poll'] as const;

export function loadConfig(): ChannelConfig {
  const server = requireEnv('ZOOID_SERVER');
  const channel = requireEnv('ZOOID_CHANNEL');
  const auth = resolveAuth();

  const transportRaw = process.env.ZOOID_TRANSPORT ?? 'auto';
  if (!VALID_TRANSPORTS.includes(transportRaw as any)) {
    throw new Error(
      `ZOOID_TRANSPORT must be one of: ${VALID_TRANSPORTS.join(', ')} (got "${transportRaw}")`,
    );
  }
  const transport = transportRaw as ChannelConfig['transport'];

  const pollInterval = process.env.ZOOID_POLL_INTERVAL
    ? parseInt(process.env.ZOOID_POLL_INTERVAL, 10)
    : 5000;

  return { server, auth, channel, transport, pollInterval };
}

function resolveAuth(): ChannelAuth {
  const token = process.env.ZOOID_TOKEN;
  if (token) {
    return { mode: 'token', token };
  }

  const clientId = process.env.ZOOID_CLIENT_ID;
  if (clientId) {
    const clientSecret = process.env.ZOOID_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error(
        'Missing required environment variable: ZOOID_CLIENT_SECRET (required when ZOOID_CLIENT_ID is set)',
      );
    }
    const tokenEndpoint = process.env.ZOOID_TOKEN_ENDPOINT;
    return {
      mode: 'client_credentials' as const,
      clientId,
      clientSecret,
      ...(tokenEndpoint && { tokenEndpoint }),
    };
  }

  throw new Error(
    'Auth not configured. Set ZOOID_TOKEN for token auth, or ZOOID_CLIENT_ID + ZOOID_CLIENT_SECRET for client credentials.',
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
