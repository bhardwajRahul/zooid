import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { printSuccess, printError, printInfo, printStep } from '../lib/output';
import { ask } from '../lib/prompts';
import { runUse } from './use';

export interface ZooidServerConfig {
  name: string;
  description: string;
  owner: string;
  company: string;
  email: string;
  tags: string[];
  url: string;
}

const CONFIG_FILENAME = 'zooid.json';

function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILENAME);
}

export function loadServerConfig(): ZooidServerConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as ZooidServerConfig;
}

export function saveServerConfig(config: ZooidServerConfig): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export async function runInit(options?: { use?: string }): Promise<void> {
  const configPath = getConfigPath();
  const existing = loadServerConfig();

  // If zooid.json already has a URL (e.g. from `zooid login`), skip interactive prompts.
  // The server already exists on Zoon — no need to configure metadata locally.
  if (existing?.url && options?.use) {
    // Ensure .zooid/workforce.json exists before running use
    const workforcePath = path.join(process.cwd(), '.zooid', 'workforce.json');
    if (!fs.existsSync(workforcePath)) {
      fs.mkdirSync(path.join(process.cwd(), '.zooid'), { recursive: true });
      fs.writeFileSync(
        workforcePath,
        JSON.stringify({ channels: {}, roles: {} }, null, 2) + '\n',
      );
    }

    await runUse(options.use);

    console.log('');
    printInfo('Server', existing.url);
    printInfo('Workforce', '.zooid/workforce.json');
    console.log('');
    printSuccess('Ready to deploy. Run: npx zooid deploy');
    console.log('');
    return;
  }

  if (existing) {
    printInfo('Found existing', configPath);
    console.log('');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('');
    console.log('  Configure your Zooid server');
    console.log('  Press Enter to accept defaults shown in [brackets].\n');

    const name = await ask(rl, 'Server name', existing?.name ?? '');
    const description = await ask(
      rl,
      'Description',
      existing?.description ?? '',
    );
    const owner = await ask(rl, 'Owner', existing?.owner ?? '');
    const company = await ask(rl, 'Company', existing?.company ?? '');
    const email = await ask(rl, 'Email', existing?.email ?? '');
    const tagsRaw = await ask(
      rl,
      'Tags (comma-separated)',
      existing?.tags?.join(', ') ?? '',
    );
    const url = await ask(
      rl,
      'URL (leave empty to assign on deploy)',
      existing?.url ?? '',
    );

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const config: ZooidServerConfig = {
      name,
      description,
      owner,
      company,
      email,
      tags,
      url,
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    // Provision .zooid/workforce.json
    const workforcePath = path.join(process.cwd(), '.zooid', 'workforce.json');
    if (!fs.existsSync(workforcePath)) {
      fs.mkdirSync(path.join(process.cwd(), '.zooid'), { recursive: true });
      fs.writeFileSync(
        workforcePath,
        JSON.stringify({ channels: {}, roles: {} }, null, 2) + '\n',
      );
    }

    console.log('');
    printSuccess(`Saved ${CONFIG_FILENAME}`);
    console.log('');
    printInfo('Name', config.name || '(not set)');
    printInfo('Description', config.description || '(not set)');
    printInfo('Owner', config.owner || '(not set)');
    printInfo('Company', config.company || '(not set)');
    printInfo('Email', config.email || '(not set)');
    printInfo(
      'Tags',
      config.tags.length > 0 ? config.tags.join(', ') : '(none)',
    );
    printInfo('URL', config.url || '(not set)');
    printInfo('Workforce', '.zooid/workforce.json');
    console.log('');
  } finally {
    rl.close();
  }

  // Run use after init if --use was provided
  if (options?.use) {
    await runUse(options.use);
  }
}
