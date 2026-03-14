import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ZooidClient } from '@zooid/sdk';
import { createClient } from '../lib/client';
import { printSuccess, printInfo, printStep } from '../lib/output';
import { ask } from '../lib/prompts';
import { type ChannelDef, loadChannelDefs } from './deploy';

export interface PushOptions {
  /** Override the delete confirmation prompt (for testing). */
  confirmDelete?: (
    orphaned: Array<{ id: string; name?: string }>,
  ) => Promise<boolean>;
}

/** Default confirmation prompt using readline. */
async function defaultConfirmDelete(
  orphaned: Array<{ id: string; name?: string }>,
): Promise<boolean> {
  console.log('');
  printInfo(
    'Warning',
    `${orphaned.length} channel(s) on server not in channels/:`,
  );
  for (const ch of orphaned) {
    printInfo('  -', `${ch.id}${ch.name ? ` (${ch.name})` : ''}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await ask(
      rl,
      'Delete these channels from server? (y/N)',
      'N',
    );
    return answer.toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

/** Push local channel definitions to the remote server. */
export async function runPush(
  client?: ZooidClient,
  options: PushOptions = {},
): Promise<void> {
  const localDefs = loadChannelDefs();
  if (localDefs.size === 0) {
    printInfo('Nothing to push', 'no channel definitions in channels/');
    return;
  }

  const c = client ?? createClient();

  printStep('Syncing channels...');

  // Get existing channels from server
  const remoteChannels = await c.listChannels();
  const remoteIds = new Set(remoteChannels.map((ch) => ch.id));
  const localIds = new Set(localDefs.keys());

  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Create new channels
  for (const [id, def] of localDefs) {
    if (!remoteIds.has(id)) {
      await c.createChannel({
        id,
        name: def.name ?? id,
        description: def.description,
        is_public: def.visibility === 'public',
        config: def.config,
      });
      printSuccess(`Channel created: ${id}`);
      created++;
    }
  }

  // Update existing channels
  for (const [id, def] of localDefs) {
    if (remoteIds.has(id)) {
      await c.updateChannel(id, {
        name: def.name,
        description: def.description,
        is_public: def.visibility === 'public',
        config: def.config,
      });
      printSuccess(`Channel updated: ${id}`);
      updated++;
    }
  }

  // Warn about channels on server but not locally
  const orphaned = remoteChannels.filter((ch) => !localIds.has(ch.id));
  if (orphaned.length > 0) {
    const confirmFn = options.confirmDelete ?? defaultConfirmDelete;
    const confirmed = await confirmFn(orphaned);
    if (confirmed) {
      for (const ch of orphaned) {
        await c.deleteChannel(ch.id);
        printSuccess(`Channel deleted: ${ch.id}`);
        deleted++;
      }
    } else {
      printInfo('Skipped', 'Remote-only channels left unchanged');
    }
  }

  if (created || updated || deleted) {
    printSuccess(
      `Channels synced (${created} created, ${updated} updated, ${deleted} deleted)`,
    );
  } else {
    printSuccess('Channels up to date');
  }
}
