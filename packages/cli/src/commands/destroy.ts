import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ZooidClient } from '@zooid/sdk';
import { loadConfigFile, getStatePath } from '../lib/config';
import { loadServerConfig } from './init';
import { printSuccess, printError, printInfo, printStep } from '../lib/output';
import { isZoonHosted } from '../lib/zoon';

// ── Helpers (exported for testing) ──────────────────────────────

export interface WranglerConfig {
  workerName: string | null;
  dbName: string | null;
  databaseId: string | null;
}

export function parseWranglerToml(content: string): WranglerConfig {
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  const dbNameMatch = content.match(/database_name\s*=\s*"([^"]+)"/);
  const dbIdMatch = content.match(/database_id\s*=\s*"([^"]+)"/);

  return {
    workerName: nameMatch?.[1] ?? null,
    dbName: dbNameMatch?.[1] ?? null,
    databaseId: dbIdMatch?.[1] ?? null,
  };
}

export function removeServerFromState(serverUrl: string): void {
  const statePath = getStatePath();
  if (!fs.existsSync(statePath)) return;

  const file = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  if (file.servers) {
    delete file.servers[serverUrl];
  }
  if (file.current === serverUrl) {
    delete file.current;
  }

  fs.writeFileSync(statePath, JSON.stringify(file, null, 2) + '\n');
}

// ── CF API helpers ──────────────────────────────────────────────

async function cfApiFetch(
  apiPath: string,
  apiToken: string,
  opts?: RequestInit,
): Promise<Response> {
  return fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...((opts?.headers as Record<string, string>) ?? {}),
    },
  });
}

async function deleteD1Database(
  accountId: string,
  databaseId: string,
  apiToken: string,
): Promise<boolean> {
  const res = await cfApiFetch(
    `/accounts/${accountId}/d1/database/${databaseId}`,
    apiToken,
    { method: 'DELETE' },
  );
  return res.ok;
}

async function deleteWorker(
  accountId: string,
  scriptName: string,
  apiToken: string,
): Promise<boolean> {
  const res = await cfApiFetch(
    `/accounts/${accountId}/workers/scripts/${scriptName}`,
    apiToken,
    { method: 'DELETE' },
  );
  return res.ok;
}

// ── .env helpers ────────────────────────────────────────────────

function loadDotEnvValue(key: string): string | undefined {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return undefined;
  const content = fs.readFileSync(envPath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match?.[1]?.trim();
}

// ── Main ────────────────────────────────────────────────────────

interface DestroyOptions {
  force?: boolean;
  keepLocal?: boolean;
}

export async function runDestroy(opts: DestroyOptions = {}): Promise<void> {
  // 1. Load project config
  const config = loadServerConfig();
  if (!config) {
    printError(
      'No zooid.json found. Run this from your Zooid project directory.',
    );
    process.exit(1);
  }

  const serverUrl = config.url;

  // 2. Check Zoon-hosted (not supported yet)
  if (serverUrl && isZoonHosted(serverUrl)) {
    printError('Zoon-hosted server destroy is not yet supported.');
    printInfo('Use the Zoon dashboard to delete your server', serverUrl);
    process.exit(1);
  }

  // 3. Read wrangler.toml for resource identifiers
  const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    printError('No wrangler.toml found. Is this a deployed Zooid project?');
    process.exit(1);
  }

  const wranglerContent = fs.readFileSync(wranglerPath, 'utf-8');
  const wrangler = parseWranglerToml(wranglerContent);

  if (!wrangler.workerName) {
    printError('Could not determine Worker name from wrangler.toml');
    process.exit(1);
  }

  // 4. Get CF credentials
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN || loadDotEnvValue('CLOUDFLARE_API_TOKEN');
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    loadDotEnvValue('CLOUDFLARE_ACCOUNT_ID');

  if (!apiToken) {
    printError(
      'Cloudflare credentials required. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.',
    );
    process.exit(1);
  }

  if (!accountId) {
    printError(
      'CLOUDFLARE_ACCOUNT_ID required. Set it in environment or .env file.',
    );
    process.exit(1);
  }

  // 5. Get admin token for server API call
  const configFile = loadConfigFile();
  const serverEntry = serverUrl ? configFile.servers?.[serverUrl] : undefined;
  const adminToken = serverEntry?.admin_token;

  // 6. List channels (for summary)
  let channelCount = 0;
  if (adminToken && serverUrl) {
    try {
      const client = new ZooidClient({
        server: serverUrl,
        token: adminToken,
      });
      const channels = await client.listChannels();
      channelCount = channels.length;
    } catch {
      // Server might already be down
    }
  }

  // 7. Confirmation
  if (!opts.force) {
    console.log('');
    console.log(
      '  \u26a0  This will permanently delete your Zooid server and all its data.',
    );
    console.log('');
    printInfo('Worker', wrangler.workerName);
    if (wrangler.dbName) printInfo('Database', wrangler.dbName);
    if (channelCount > 0) printInfo('Channels', `${channelCount}`);
    console.log('');
    console.log('  This action cannot be undone.');
    console.log('');

    const serverSlug = wrangler.workerName.replace(/^zooid-/, '');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await rl.question(
        `  Type the server name to confirm (${serverSlug}): `,
      );
      if (answer.trim() !== serverSlug) {
        printError('Name does not match. Aborting.');
        process.exit(1);
      }
    } finally {
      rl.close();
    }
  }

  // 8. Destroy DOs via server admin endpoint
  if (adminToken && serverUrl) {
    printStep('Destroying Durable Objects...');
    try {
      const res = await fetch(`${serverUrl}/api/v1/admin/destroy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        const body = (await res.json()) as {
          destroyed: number;
          channels: string[];
        };
        printSuccess(`${body.destroyed} Durable Object(s) destroyed`);
      } else {
        console.warn(
          '  Warning: Could not destroy DOs \u2014 server may be unreachable.',
        );
      }
    } catch {
      console.warn(
        '  Warning: Server unreachable \u2014 Durable Objects may not be fully cleaned up.',
      );
    }
  }

  // 9. Delete D1 database
  if (wrangler.databaseId) {
    printStep('Deleting D1 database...');
    const dbOk = await deleteD1Database(
      accountId,
      wrangler.databaseId,
      apiToken,
    );
    if (dbOk) {
      printSuccess(`Deleted ${wrangler.dbName ?? wrangler.databaseId}`);
    } else {
      console.warn(
        '  Warning: Could not delete D1 database (may already be deleted).',
      );
    }
  }

  // 10. Delete Worker
  printStep('Deleting Worker...');
  const workerOk = await deleteWorker(accountId, wrangler.workerName, apiToken);
  if (workerOk) {
    printSuccess(`Deleted ${wrangler.workerName}`);
  } else {
    console.warn(
      '  Warning: Could not delete Worker (may already be deleted).',
    );
  }

  // 11. Clean up local files
  if (!opts.keepLocal) {
    printStep('Cleaning up local files...');

    if (fs.existsSync(wranglerPath)) {
      fs.unlinkSync(wranglerPath);
      printSuccess('Removed wrangler.toml');
    }

    if (serverUrl) {
      removeServerFromState(serverUrl);
      printSuccess('Removed server entry from ~/.zooid/state.json');
    }
  }

  // 12. Done
  console.log('');
  printSuccess('Server destroyed.');
  console.log(
    '  If you configured a custom domain, remember to remove the DNS record.',
  );
}
