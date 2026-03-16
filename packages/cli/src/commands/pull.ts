import fs from 'node:fs';
import path from 'node:path';
import { ZooidClient } from '@zooid/sdk';
import { createClient } from '../lib/client';
import { getZooidDir } from '../lib/project';
import { printSuccess, printInfo, printStep } from '../lib/output';
import type { ChannelDef } from '../lib/channels';
import type { RoleDef } from '../lib/roles';

/** Pull remote channel and role definitions into .zooid/ files. */
export async function runPull(client?: ZooidClient): Promise<string[]> {
  const c = client ?? createClient();
  const zooidDir = getZooidDir();
  const written: string[] = [];

  // Pull channels
  const channels = await c.listChannels();

  if (channels.length > 0) {
    const channelsDir = path.join(zooidDir, 'channels');
    fs.mkdirSync(channelsDir, { recursive: true });

    printStep('Pulling channels...');

    for (const ch of channels) {
      const filePath = path.join(channelsDir, `${ch.id}.json`);
      const def: ChannelDef = {
        visibility: ch.is_public ? 'public' : 'private',
      };
      if (ch.name && ch.name !== ch.id) def.name = ch.name;
      if (ch.description) def.description = ch.description;
      if (ch.config) def.config = ch.config;

      fs.writeFileSync(filePath, JSON.stringify(def, null, 2) + '\n');
      printSuccess(`.zooid/channels/${ch.id}.json`);
      written.push(ch.id);
    }

    printSuccess(`Pulled ${written.length} channel(s) into .zooid/channels/`);
  } else {
    printInfo('Nothing to pull', 'no channels on server');
  }

  // Pull roles
  try {
    const roles = await c.listRoles();
    if (roles.length > 0) {
      const rolesDir = path.join(zooidDir, 'roles');
      fs.mkdirSync(rolesDir, { recursive: true });

      printStep('Pulling roles...');

      for (const role of roles) {
        const filePath = path.join(rolesDir, `${role.id}.json`);
        const def: RoleDef = { scopes: role.scopes };
        if (role.name) def.name = role.name;
        if (role.description) def.description = role.description;
        fs.writeFileSync(filePath, JSON.stringify(def, null, 2) + '\n');
        printSuccess(`.zooid/roles/${role.id}.json`);
      }

      printSuccess(`Pulled ${roles.length} role(s) into .zooid/roles/`);
    }
  } catch {
    // Server may not support roles endpoint yet — skip silently
  }

  return written;
}
