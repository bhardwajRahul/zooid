import { execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createRequire } from 'node:module';
import { ZooidClient } from '@zooid/sdk';
import { loadConfig, saveConfig } from '../lib/config';
import { createEdDSAAdminToken } from '../lib/crypto';
import { printSuccess, printError, printInfo, printStep } from '../lib/output';
import { loadServerConfig, saveServerConfig, runInit } from './init';

const require = createRequire(import.meta.url);

/** Resolve the directory of an installed npm package. */
function resolvePackageDir(packageName: string): string {
  const pkgJson = require.resolve(`${packageName}/package.json`);
  return path.dirname(pkgJson);
}

/** Path to the user's wrangler.toml in the project directory. */
const USER_WRANGLER_TOML = path.join(process.cwd(), 'wrangler.toml');

/**
 * Eject a wrangler.toml template into the user's project directory.
 * Only called on first deploy. The user can then customize it freely.
 */
function ejectWranglerToml(opts: {
  workerName: string;
  dbName: string;
  databaseId: string;
  serverSlug: string;
}): void {
  const serverDir = resolvePackageDir('@zooid/server');
  let toml = fs.readFileSync(path.join(serverDir, 'wrangler.toml'), 'utf-8');

  // Rewrite asset directory for staging layout
  toml = toml.replace(/directory\s*=\s*"[^"]*"/, 'directory = "./web-dist/"');

  // Fill in deploy-specific values
  toml = toml.replace(/name = "[^"]*"/, `name = "${opts.workerName}"`);
  toml = toml.replace(
    /database_name = "[^"]*"/,
    `database_name = "${opts.dbName}"`,
  );
  toml = toml.replace(
    /database_id = "[^"]*"/,
    `database_id = "${opts.databaseId}"`,
  );
  toml = toml.replace(
    /ZOOID_SERVER_ID = "[^"]*"/,
    `ZOOID_SERVER_ID = "${opts.serverSlug}"`,
  );

  fs.writeFileSync(USER_WRANGLER_TOML, toml);
}

/**
 * Set up a temporary deploy directory with the server source and web assets.
 * Uses the user's wrangler.toml if it exists, otherwise the template from @zooid/server.
 * Returns the path to the temp directory.
 */
function prepareStagingDir(): string {
  const serverDir = resolvePackageDir('@zooid/server');
  // @zooid/web is a dependency of @zooid/server, not the CLI — resolve from there
  const serverRequire = createRequire(path.join(serverDir, 'package.json'));
  const webDir = path.dirname(serverRequire.resolve('@zooid/web/package.json'));
  const webDistDir = path.join(webDir, 'dist');

  if (!fs.existsSync(webDistDir)) {
    throw new Error(`Web dashboard not built. Missing: ${webDistDir}`);
  }

  // Create temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-deploy-'));

  // Copy server source
  copyDirSync(path.join(serverDir, 'src'), path.join(tmpDir, 'src'));

  // Copy web dist
  copyDirSync(webDistDir, path.join(tmpDir, 'web-dist'));

  // Use user's wrangler.toml if it exists, otherwise fall back to template
  if (fs.existsSync(USER_WRANGLER_TOML)) {
    fs.copyFileSync(USER_WRANGLER_TOML, path.join(tmpDir, 'wrangler.toml'));
  } else {
    if (!fs.existsSync(path.join(serverDir, 'wrangler.toml'))) {
      throw new Error(`Server package missing wrangler.toml at ${serverDir}`);
    }
    let toml = fs.readFileSync(path.join(serverDir, 'wrangler.toml'), 'utf-8');
    toml = toml.replace(/directory\s*=\s*"[^"]*"/, 'directory = "./web-dist/"');
    fs.writeFileSync(path.join(tmpDir, 'wrangler.toml'), toml);
  }

  // Symlink node_modules so wrangler/esbuild can resolve server dependencies
  const nodeModules = findServerNodeModules(serverDir);
  if (nodeModules) {
    fs.symlinkSync(nodeModules, path.join(tmpDir, 'node_modules'), 'junction');
  }

  return tmpDir;
}

/**
 * Find the node_modules directory that contains the server's dependencies.
 * pnpm doesn't put deps in the package's own node_modules — they live in
 * the virtual store or the workspace root.
 */
function findServerNodeModules(serverDir: string): string | null {
  // 1. Server has its own node_modules (npm/yarn, or pnpm with hoisting)
  const local = path.join(serverDir, 'node_modules');
  if (fs.existsSync(path.join(local, 'hono'))) return local;

  // 2. pnpm virtual store: @zooid/server lives at .pnpm/<hash>/node_modules/@zooid/server
  //    and sibling deps (hono, zod, etc.) are at .pnpm/<hash>/node_modules/
  const storeNodeModules = path.resolve(serverDir, '..', '..');
  if (fs.existsSync(path.join(storeNodeModules, 'hono')))
    return storeNodeModules;

  // 3. Walk up from serverDir to find any ancestor node_modules with hono
  let dir = serverDir;
  while (dir !== path.dirname(dir)) {
    dir = path.dirname(dir);
    const nm = path.join(dir, 'node_modules');
    if (fs.existsSync(path.join(nm, 'hono'))) return nm;
  }

  return null;
}

/** Recursively copy a directory. */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

interface CfCredentials {
  apiToken: string;
  accountId?: string;
}

/** Run a wrangler command with CF credentials in env. Returns stdout. */
function wranglerEnv(creds: CfCredentials): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: creds.apiToken,
  };
  if (creds.accountId) {
    env.CLOUDFLARE_ACCOUNT_ID = creds.accountId;
  }
  return env;
}

function wrangler(
  cmd: string,
  cwd: string,
  creds: CfCredentials,
  opts?: { input?: string },
): string {
  return execSync(`npx wrangler ${cmd}`, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
    env: wranglerEnv(creds),
    input: opts?.input,
  });
}

/** Run wrangler with output streamed to the terminal and captured. */
function wranglerVerbose(
  cmd: string,
  cwd: string,
  creds: CfCredentials,
): string {
  const result = spawnSync('npx', ['wrangler', ...cmd.split(' ')], {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
    env: wranglerEnv(creds),
    timeout: 5 * 60 * 1000, // 5 minute timeout
    shell: true,
  });
  // Print captured output so the user sees what wrangler did
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`wrangler ${cmd} exited with code ${result.status}`);
  }
  return result.stdout ?? '';
}

interface DeployUrls {
  workerUrl: string | null;
  customDomain: string | null;
}

function parseDeployUrls(output: string): DeployUrls {
  const workersDev = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  const custom = output.match(
    /^\s+(\S+\.(?!workers\.dev)\S+)\s+\(custom domain\)/m,
  );

  return {
    workerUrl: workersDev ? workersDev[0] : null,
    customDomain: custom ? `https://${custom[1]}` : null,
  };
}

function loadDotEnv(): Partial<CfCredentials> {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');

  const tokenMatch = content.match(/^CLOUDFLARE_API_TOKEN=(.+)$/m);
  const accountMatch = content.match(/^CLOUDFLARE_ACCOUNT_ID=(.+)$/m);

  return {
    apiToken: tokenMatch ? tokenMatch[1].trim() : undefined,
    accountId: accountMatch ? accountMatch[1].trim() : undefined,
  };
}

async function getCfCredentials(): Promise<CfCredentials> {
  const envToken = process.env.CLOUDFLARE_API_TOKEN;
  const envAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (envToken) {
    return { apiToken: envToken, accountId: envAccount };
  }

  const dotEnv = loadDotEnv();
  if (dotEnv.apiToken) {
    printInfo('Using credentials from', '.env');
    return { apiToken: dotEnv.apiToken, accountId: dotEnv.accountId };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('');
    console.log('  Cloudflare API token required for deployment.');
    console.log('  Go to: https://dash.cloudflare.com/profile/api-tokens');
    console.log(
      '  Use the "Edit Cloudflare Workers" template, then add D1 Edit permission.',
    );
    console.log('  Tip: save credentials in .env to skip this prompt.');
    console.log('');
    const token = await rl.question('  API token: ');
    const accountId = await rl.question(
      '  Account ID (from the dashboard URL or Workers overview): ',
    );
    return {
      apiToken: token.trim(),
      accountId: accountId.trim() || undefined,
    };
  } finally {
    rl.close();
  }
}

export async function runDeploy(): Promise<void> {
  // 1. Load zooid.json (run init if missing)
  let config = loadServerConfig();

  if (!config) {
    printInfo('No zooid.json found', 'starting setup...');
    console.log('');
    await runInit();
    config = loadServerConfig();
  }

  if (!config) {
    printError('Failed to load zooid.json after init');
    process.exit(1);
  }

  // 2. Prepare staging directory from npm packages
  let stagingDir: string;
  try {
    stagingDir = prepareStagingDir();
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }

  // Derive unique names from server name
  const serverSlug = config.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');
  const dbName = `zooid-db-${serverSlug}`;
  const workerName = `zooid-${serverSlug}`;

  // 3. Check wrangler available
  try {
    execSync('npx wrangler --version', { cwd: stagingDir, stdio: 'pipe' });
  } catch {
    printError('wrangler not found. Install with: npm install -g wrangler');
    process.exit(1);
  }

  // 4. Get CF credentials
  const creds = await getCfCredentials();

  try {
    wrangler('whoami', stagingDir, creds);
    printSuccess('Cloudflare authentication verified');
  } catch {
    printError('Invalid Cloudflare API token');
    cleanup(stagingDir);
    process.exit(1);
  }

  // 5. Detect first deploy vs redeploy
  let isFirstDeploy = false;
  try {
    const output = wrangler('d1 list --json', stagingDir, creds);
    const databases = JSON.parse(output) as Array<{ name: string }>;
    isFirstDeploy = !databases.some((db) => db.name === dbName);
  } catch {
    isFirstDeploy = true;
  }

  let adminToken: string | undefined;

  if (isFirstDeploy) {
    console.log('');
    printInfo('Deploy type', 'First deploy — setting up database and secrets');
    console.log('');

    // 6. Create D1 database
    printStep(`Creating D1 database (${dbName})...`);
    const d1Output = wrangler(`d1 create ${dbName}`, stagingDir, creds);

    const dbIdMatch = d1Output.match(/database_id\s*=\s*"([^"]+)"/);
    if (!dbIdMatch) {
      printError('Failed to parse database ID from wrangler output');
      console.log(d1Output);
      cleanup(stagingDir);
      process.exit(1);
    }

    const databaseId = dbIdMatch[1];
    printSuccess(`D1 database created (${databaseId})`);

    // Eject wrangler.toml into user's project directory
    ejectWranglerToml({ workerName, dbName, databaseId, serverSlug });
    // Copy into staging dir for this deploy
    fs.copyFileSync(USER_WRANGLER_TOML, path.join(stagingDir, 'wrangler.toml'));
    printSuccess(
      'Created wrangler.toml (edit to add vars, observability, etc.)',
    );

    // 7. Run schema migration
    const schemaPath = path.join(stagingDir, 'src/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      printStep('Running database schema migration...');
      wrangler(
        `d1 execute ${dbName} --remote --file=${schemaPath}`,
        stagingDir,
        creds,
      );
      printSuccess('Database schema initialized');
    }

    // 8. Generate secrets
    printStep('Generating secrets...');

    const keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const privateKeyRaw = await crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey,
    );
    const publicKeyRaw = await crypto.subtle.exportKey(
      'raw',
      keyPair.publicKey,
    );
    const privateKeyJwk = await crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey,
    );
    const publicKeyJwk = await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey,
    );
    const privateKeyB64 = Buffer.from(privateKeyRaw).toString('base64');
    const publicKeyB64 = Buffer.from(publicKeyRaw).toString('base64');

    wrangler('secret put ZOOID_SIGNING_KEY', stagingDir, creds, {
      input: privateKeyB64,
    });
    printSuccess('Set ZOOID_SIGNING_KEY (Ed25519 private)');

    wrangler('secret put ZOOID_PUBLIC_KEY', stagingDir, creds, {
      input: publicKeyB64,
    });
    printSuccess('Set ZOOID_PUBLIC_KEY (Ed25519 public)');

    // 9. Register public key in D1 trusted_keys
    const kid = 'local-1';
    const xValue = publicKeyJwk.x!;
    const insertSql = `INSERT INTO trusted_keys (kid, x, issuer) VALUES ('${kid}', '${xValue}', 'local');`;
    wrangler(
      `d1 execute ${dbName} --remote --command="${insertSql}"`,
      stagingDir,
      creds,
    );
    printSuccess(`Registered EdDSA public key (kid: ${kid})`);

    // 10. Mint EdDSA admin token
    adminToken = await createEdDSAAdminToken(privateKeyJwk, kid);
    printSuccess('EdDSA admin token generated');
  } else {
    console.log('');
    printInfo('Deploy type', 'Redeploying existing server');
    console.log('');

    // Use user's wrangler.toml — it already has the correct values.
    // If missing (e.g. old deploy), eject one now.
    if (!fs.existsSync(USER_WRANGLER_TOML)) {
      printStep('Ejecting wrangler.toml...');
      // Need database ID for the toml
      let databaseId = '';
      try {
        const output = wrangler('d1 list --json', stagingDir, creds);
        const databases = JSON.parse(output) as Array<{
          name: string;
          uuid: string;
        }>;
        const db = databases.find((d) => d.name === dbName);
        if (db) databaseId = db.uuid;
      } catch {
        // Fall through
      }
      ejectWranglerToml({ workerName, dbName, databaseId, serverSlug });
      printSuccess(
        'Created wrangler.toml (edit to add vars, observability, etc.)',
      );
    }

    // Copy user's toml into staging dir
    fs.copyFileSync(USER_WRANGLER_TOML, path.join(stagingDir, 'wrangler.toml'));

    // Run schema migration (idempotent — all CREATE IF NOT EXISTS)
    const schemaPath = path.join(stagingDir, 'src/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      printStep('Running schema migration...');
      wrangler(
        `d1 execute ${dbName} --remote --file=${schemaPath}`,
        stagingDir,
        creds,
      );
      printSuccess('Schema up to date');
    }

    // Run SQL migration files (each is idempotent — ALTERs fail silently if column exists)
    const migrationsDir = path.join(stagingDir, 'src/db/migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort();
      for (const file of migrationFiles) {
        const migrationPath = path.join(migrationsDir, file);
        try {
          wrangler(
            `d1 execute ${dbName} --remote --file=${migrationPath}`,
            stagingDir,
            creds,
          );
        } catch {
          // Migration already applied or non-fatal — skip
        }
      }
    }

    // Ensure EdDSA key is registered (upgrades old HS256-only deploys)
    try {
      const keysOutput = wrangler(
        `d1 execute ${dbName} --remote --json --command="SELECT kid FROM trusted_keys WHERE issuer = 'local' LIMIT 1"`,
        stagingDir,
        creds,
      );
      const keysResult = JSON.parse(keysOutput);
      const hasLocalKey = keysResult?.[0]?.results?.length > 0;

      if (!hasLocalKey) {
        printStep('Upgrading to EdDSA auth...');
        const keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
          'sign',
          'verify',
        ])) as CryptoKeyPair;
        const privateKeyRaw = await crypto.subtle.exportKey(
          'pkcs8',
          keyPair.privateKey,
        );
        const publicKeyRaw = await crypto.subtle.exportKey(
          'raw',
          keyPair.publicKey,
        );
        const privateKeyJwk = await crypto.subtle.exportKey(
          'jwk',
          keyPair.privateKey,
        );
        const publicKeyJwk = await crypto.subtle.exportKey(
          'jwk',
          keyPair.publicKey,
        );
        const privateKeyB64 = Buffer.from(privateKeyRaw).toString('base64');
        const publicKeyB64 = Buffer.from(publicKeyRaw).toString('base64');

        wrangler('secret put ZOOID_SIGNING_KEY', stagingDir, creds, {
          input: privateKeyB64,
        });
        wrangler('secret put ZOOID_PUBLIC_KEY', stagingDir, creds, {
          input: publicKeyB64,
        });

        const kid = 'local-1';
        const xValue = publicKeyJwk.x!;
        const insertSql = `INSERT INTO trusted_keys (kid, x, issuer) VALUES ('${kid}', '${xValue}', 'local');`;
        wrangler(
          `d1 execute ${dbName} --remote --command="${insertSql}"`,
          stagingDir,
          creds,
        );
        printSuccess('EdDSA keypair generated and registered');

        // Mint new EdDSA admin token (replaces old HS256 one)
        adminToken = await createEdDSAAdminToken(privateKeyJwk, kid);
        printSuccess('Upgraded to EdDSA admin token');
      }
    } catch {
      // Non-fatal — old HS256 token still works
      printInfo(
        'Note',
        'Could not check EdDSA key status, keeping existing token',
      );
    }

    if (!adminToken) {
      const existingConfig = loadConfig();
      adminToken = existingConfig.admin_token;
    }

    if (!adminToken) {
      printError('No admin token found in ~/.zooid/state.json for this server');
      console.log(
        'If this is a first deploy, remove the D1 database and try again.',
      );
      cleanup(stagingDir);
      process.exit(1);
    }
  }

  // 10. Deploy worker
  printStep('Deploying worker...');
  const deployOutput = wranglerVerbose('deploy', stagingDir, creds);

  const { workerUrl, customDomain } = parseDeployUrls(deployOutput);
  printSuccess('Worker deployed');
  if (workerUrl) {
    printInfo('Worker URL', workerUrl);
  }
  if (customDomain) {
    printInfo('Custom domain', customDomain);
  }

  const canonicalUrl = config.url || customDomain || workerUrl;

  // 11. Push server identity
  await new Promise((r) => setTimeout(r, 2000));
  if (canonicalUrl && adminToken) {
    try {
      const client = new ZooidClient({
        server: canonicalUrl,
        token: adminToken,
      });
      await client.updateServerMeta({
        name: config.name || undefined,
        description: config.description || undefined,
        tags: config.tags.length > 0 ? config.tags : undefined,
        owner: config.owner || undefined,
        company: config.company || undefined,
        email: config.email || undefined,
      });
      printSuccess('Server identity updated');
    } catch (err) {
      printError(
        `Failed to push server identity: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // 12. Save config
  if (!config.url && (customDomain || workerUrl)) {
    config.url = customDomain || workerUrl!;
    saveServerConfig(config);
    printSuccess('Saved URL to zooid.json');
  }

  const configToSave: Parameters<typeof saveConfig>[0] = {
    worker_url: workerUrl || undefined,
    admin_token: adminToken,
  };
  if (isFirstDeploy) {
    configToSave.channels = {};
  }
  saveConfig(configToSave, canonicalUrl || undefined);
  printSuccess('Saved connection config to ~/.zooid/state.json');

  // Cleanup staging dir
  cleanup(stagingDir);

  // 13. Print summary
  console.log('');
  console.log('  ──────────────────────────────────────');
  console.log('  🪸 Zooid server deployed!');
  console.log('  ──────────────────────────────────────');
  printInfo('Server', canonicalUrl || '(unknown)');
  if (workerUrl && workerUrl !== canonicalUrl) {
    printInfo('Worker URL', workerUrl);
  }
  printInfo('Name', config.name || '(not set)');
  if (isFirstDeploy) {
    printInfo('Admin token', adminToken!.slice(0, 20) + '...');
  }
  printInfo('Config', '~/.zooid/state.json');
  console.log('');
  if (isFirstDeploy) {
    console.log('  Next steps:');
    console.log('    Edit wrangler.toml to add env vars, observability, etc.');
    console.log('    npx zooid channel create my-channel');
    console.log(
      '    npx zooid publish my-channel --data=\'{"hello": "world"}\'',
    );
    console.log('');
  }
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}
