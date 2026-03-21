import { ZooidClient } from '@zooid/sdk';
import { createClient } from '../lib/client';
import { loadWorkforce, saveWorkforce } from '../lib/workforce';
import { printSuccess, printInfo, printStep } from '../lib/output';
import type { ChannelDef } from '../lib/channels';
import type { RoleDef } from '../lib/roles';

/** Pull remote channel and role definitions into .zooid/workforce.json. */
export async function runPull(client?: ZooidClient): Promise<string[]> {
  const c = client ?? createClient();
  const wf = loadWorkforce();
  const written: string[] = [];

  // Pull channels
  const channels = await c.listChannels();

  if (channels.length > 0) {
    printStep('Pulling channels...');

    for (const ch of channels) {
      const def: ChannelDef = {
        visibility: ch.is_public ? 'public' : 'private',
      };
      if (ch.name && ch.name !== ch.id) def.name = ch.name;
      if (ch.description) def.description = ch.description;
      if (ch.config) def.config = ch.config;

      wf.channels[ch.id] = def;
      written.push(ch.id);
    }
  }

  // Pull roles
  try {
    const roles = await c.listRoles();
    if (roles.length > 0) {
      printStep('Pulling roles...');

      for (const role of roles) {
        const def: RoleDef = { scopes: role.scopes };
        if (role.name) def.name = role.name;
        if (role.description) def.description = role.description;
        wf.roles[role.id] = def;
      }
    }
  } catch {
    // Server may not support roles endpoint yet — skip silently
  }

  saveWorkforce(wf);

  if (written.length > 0 || Object.keys(wf.roles).length > 0) {
    printSuccess(
      `Pulled ${written.length} channel(s) and ${Object.keys(wf.roles).length} role(s) into .zooid/workforce.json`,
    );
  } else {
    printInfo('Nothing to pull', 'no channels or roles on server');
  }

  return written;
}
