import type { MintTokenOptions, MintTokenResult } from '@zooid/sdk';
import { createClient } from '../lib/client';

export async function runTokenMint(
  scopes: string[],
  options: {
    sub?: string;
    name?: string;
    expiresIn?: string;
  },
): Promise<MintTokenResult> {
  const client = createClient();

  const body: MintTokenOptions = { scopes };
  if (options.sub) body.sub = options.sub;
  if (options.name) body.name = options.name;
  if (options.expiresIn) body.expires_in = options.expiresIn;

  return client.mintToken(body);
}
