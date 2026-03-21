import { createClient } from '../lib/client';
import { loadConfig, loadConfigFile } from '../lib/config';

export interface WhoamiResult {
  server: string;
  sub: string;
  name?: string;
  scopes: string[];
  exp?: number;
  authMethod?: string;
}

export async function runWhoami(): Promise<WhoamiResult> {
  const config = loadConfig();
  const file = loadConfigFile();

  if (!config.server) {
    throw new Error('No server configured. Run: npx zooid login');
  }

  const client = createClient();
  const claims = await client.getTokenClaims();
  const entry = file.servers?.[config.server];

  return {
    server: config.server,
    sub: claims.sub ?? 'unknown',
    name: claims.name,
    scopes: claims.scopes ?? [],
    exp: claims.exp,
    authMethod: entry?.auth_method,
  };
}
