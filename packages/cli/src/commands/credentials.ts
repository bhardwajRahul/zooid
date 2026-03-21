import { loadConfigFile, resolveServer } from '../lib/config';
import {
  createCredential,
  listCredentials,
  rotateCredential,
  revokeCredential,
  isZoonHosted,
} from '../lib/zoon';
import { loadWorkforce } from '../lib/workforce';

function requireZoonServer(): { server: string; platformToken: string } {
  const server = resolveServer();
  if (!server) {
    throw new Error('No server configured. Run: npx zooid login');
  }
  if (!isZoonHosted(server)) {
    throw new Error(
      'Credentials are only available for Zoon-hosted servers (*.zoon.eco)',
    );
  }
  const file = loadConfigFile();
  const entry = file.servers?.[server];
  if (!entry?.platform_token) {
    throw new Error(
      'Not authenticated with Zoon platform. Run: npx zooid login',
    );
  }
  return { server, platformToken: entry.platform_token };
}

function formatEnv(
  server: string,
  clientId: string,
  clientSecret: string,
): string {
  return [
    `ZOOID_SERVER=${server}`,
    `ZOOID_CLIENT_ID=${clientId}`,
    `ZOOID_CLIENT_SECRET=${clientSecret}`,
  ].join('\n');
}

export async function runCredentialsCreate(
  name: string,
  options: { role?: string[] },
): Promise<string> {
  const { server, platformToken } = requireZoonServer();

  // Resolve roles: explicit --role, or auto-match from workforce
  let roleNames = options.role;
  if (!roleNames || roleNames.length === 0) {
    const wf = loadWorkforce();
    if (wf.roles[name]) {
      roleNames = [name];
    } else {
      throw new Error(
        `No roles specified and no matching agent/role "${name}" found in workforce.json`,
      );
    }
  }

  const result = await createCredential(server, platformToken, name, roleNames);

  process.stderr.write(
    `\n  Created credential "${name}" on ${server} (roles: ${roleNames.join(', ')})\n\n`,
  );

  return formatEnv(server, result.client_id, result.client_secret);
}

export async function runCredentialsList() {
  const { server, platformToken } = requireZoonServer();
  return listCredentials(server, platformToken);
}

/** Resolve a credential name to its client_id. Accepts either name or client_id. */
async function resolveClientId(
  nameOrId: string,
): Promise<{ clientId: string; name: string }> {
  const { server, platformToken } = requireZoonServer();
  const creds = await listCredentials(server, platformToken);
  // Try matching by name first, then by client_id
  const match =
    creds.find((c) => c.name === nameOrId) ||
    creds.find((c) => c.client_id === nameOrId);
  if (!match) {
    throw new Error(
      `Credential "${nameOrId}" not found. Run: npx zooid credentials list`,
    );
  }
  return { clientId: match.client_id, name: match.name };
}

export async function runCredentialsRotate(nameOrId: string): Promise<string> {
  const { server, platformToken } = requireZoonServer();
  const { clientId, name } = await resolveClientId(nameOrId);
  const result = await rotateCredential(server, platformToken, clientId);

  process.stderr.write(`\n  Rotated credential "${name}" on ${server}\n\n`);

  return formatEnv(server, result.client_id, result.client_secret);
}

export async function runCredentialsRevoke(nameOrId: string): Promise<void> {
  const { server, platformToken } = requireZoonServer();
  const { clientId, name } = await resolveClientId(nameOrId);
  await revokeCredential(server, platformToken, clientId);

  process.stderr.write(`\n  Revoked credential "${name}" on ${server}\n`);
}
