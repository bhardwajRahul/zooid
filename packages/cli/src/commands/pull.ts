import fs from 'node:fs';
import path from 'node:path';
import { ZooidClient } from '@zooid/sdk';
import { createClient } from '../lib/client';
import { printSuccess, printInfo, printStep } from '../lib/output';
import type { ChannelDef } from './deploy';

/** Pull remote channel definitions into channels/*.json files. */
export async function runPull(client?: ZooidClient): Promise<string[]> {
  const c = client ?? createClient();
  const channels = await c.listChannels();

  if (channels.length === 0) {
    printInfo('Nothing to pull', 'no channels on server');
    return [];
  }

  const channelsDir = path.join(process.cwd(), 'channels');
  fs.mkdirSync(channelsDir, { recursive: true });

  printStep('Pulling channels...');

  const written: string[] = [];

  for (const ch of channels) {
    const filePath = path.join(channelsDir, `${ch.id}.json`);

    const def: ChannelDef = {
      visibility: ch.is_public ? 'public' : 'private',
    };
    if (ch.name && ch.name !== ch.id) def.name = ch.name;
    if (ch.description) def.description = ch.description;
    if (ch.config) def.config = ch.config;

    fs.writeFileSync(filePath, JSON.stringify(def, null, 2) + '\n');
    printSuccess(`channels/${ch.id}.json`);
    written.push(ch.id);
  }

  printSuccess(`Pulled ${written.length} channel(s) into channels/`);
  return written;
}
