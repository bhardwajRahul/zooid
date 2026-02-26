import type { MintTokenOptions, MintTokenResult } from '@zooid/sdk';
import { createClient } from '../lib/client';

export async function runTokenMint(
  scope: 'admin' | 'publish' | 'subscribe',
  options: {
    channels?: string[];
    sub?: string;
    name?: string;
    expiresIn?: string;
  },
): Promise<MintTokenResult> {
  const client = createClient();

  const body: MintTokenOptions = { scope };
  if (options.channels?.length) body.channels = options.channels;
  if (options.sub) body.sub = options.sub;
  if (options.name) body.name = options.name;
  if (options.expiresIn) body.expires_in = options.expiresIn;

  return client.mintToken(body);
}
