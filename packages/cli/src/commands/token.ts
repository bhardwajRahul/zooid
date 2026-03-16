import type { MintTokenOptions, MintTokenResult } from '@zooid/sdk';
import { createClient } from '../lib/client';
import { resolveRoleScopes } from '../lib/resolve-roles';

export async function runTokenMint(
  scopes: string[],
  options: {
    sub?: string;
    name?: string;
    expiresIn?: string;
    role?: string[];
  },
): Promise<MintTokenResult> {
  const client = createClient();

  // --role and explicit scopes are mutually exclusive
  if (options.role?.length && scopes.length) {
    throw new Error('Cannot combine --role with explicit scopes');
  }

  // Resolve roles to scopes
  if (options.role?.length) {
    scopes = resolveRoleScopes(options.role);
  }

  const body: MintTokenOptions = { scopes };
  if (options.sub) body.sub = options.sub;
  if (options.name) body.name = options.name;
  if (options.expiresIn) body.expires_in = options.expiresIn;
  if (options.role?.length) body.groups = options.role;

  return client.mintToken(body);
}
