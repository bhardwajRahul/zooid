import readline from 'node:readline/promises';
import type { ZooidClient } from '@zooid/sdk';
import { loadChannelDefs } from './channels';
import { printSuccess, printInfo } from './output';
import { ask } from './prompts';

export interface SyncOptions {
  /** Override the delete confirmation prompt (for testing). */
  confirmDelete?: (
    orphaned: Array<{ id: string; name?: string }>,
  ) => Promise<boolean>;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
}

/** Default confirmation prompt using readline. */
async function defaultConfirmDelete(
  orphaned: Array<{ id: string; name?: string }>,
): Promise<boolean> {
  console.log('');
  printInfo(
    'Warning',
    `${orphaned.length} channel(s) on server not in .zooid/channels/:`,
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

/**
 * Sync local .zooid/channels/ to the server.
 * Creates new, updates existing, prompts to delete orphans.
 */
export async function syncChannelsToServer(
  client: ZooidClient,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const localDefs = loadChannelDefs();
  const remoteChannels = await client.listChannels();
  const remoteIds = new Set(remoteChannels.map((ch) => ch.id));
  const localIds = new Set(localDefs.keys());

  let created = 0;
  let updated = 0;
  let deleted = 0;

  // Create new channels
  for (const [id, def] of localDefs) {
    if (!remoteIds.has(id)) {
      await client.createChannel({
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
      await client.updateChannel(id, {
        name: def.name,
        description: def.description,
        is_public: def.visibility === 'public',
        config: def.config,
      });
      printSuccess(`Channel updated: ${id}`);
      updated++;
    }
  }

  // Prompt to delete orphaned channels
  const orphaned = remoteChannels.filter((ch) => !localIds.has(ch.id));
  if (orphaned.length > 0) {
    const confirmFn = options.confirmDelete ?? defaultConfirmDelete;
    const confirmed = await confirmFn(orphaned);
    if (confirmed) {
      for (const ch of orphaned) {
        await client.deleteChannel(ch.id);
        printSuccess(`Channel deleted: ${ch.id}`);
        deleted++;
      }
    } else {
      printInfo('Skipped', 'Remote-only channels left unchanged');
    }
  }

  return { created, updated, deleted };
}
