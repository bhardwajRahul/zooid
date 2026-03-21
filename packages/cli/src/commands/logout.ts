import fs from 'node:fs';
import {
  loadConfigFile,
  resolveServer,
  getConfigDir,
  getStatePath,
} from '../lib/config';

export async function runLogout(options: { all?: boolean }): Promise<void> {
  const file = loadConfigFile();

  if (options.all) {
    for (const url of Object.keys(file.servers ?? {})) {
      clearServerAuth(file, url);
    }
    process.stderr.write('Logged out of all servers\n');
  } else {
    const server = resolveServer();
    if (!server) {
      throw new Error('No server configured.');
    }
    clearServerAuth(file, server);
    process.stderr.write(`Logged out of ${server}\n`);
  }

  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getStatePath(), JSON.stringify(file, null, 2) + '\n');
}

function clearServerAuth(
  file: ReturnType<typeof loadConfigFile>,
  url: string,
): void {
  const entry = file.servers?.[url];
  if (!entry) return;
  delete entry.admin_token;
  delete entry.refresh_token;
  delete entry.auth_method;
}
