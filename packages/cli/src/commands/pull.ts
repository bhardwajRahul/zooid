import { ZooidClient } from '@zooid/sdk';
import { createClient } from '../lib/client';
import { loadWorkforce, saveWorkforce, updateInFile } from '../lib/workforce';
import { loadConfigFile, resolveServer } from '../lib/config';
import { isZoonHosted, listRolesFromZoon } from '../lib/zoon';
import { printSuccess, printInfo, printStep } from '../lib/output';
import type { ChannelDef } from '../lib/channels';
import type { RoleDef } from '../lib/roles';

/** Pull remote channel and role definitions into .zooid/workforce.json. */
export async function runPull(client?: ZooidClient): Promise<string[]> {
  const c = client ?? createClient();
  const wf = loadWorkforce();
  const written: string[] = [];
  let newChannelsAdded = false;

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

      // Write to the file that owns this channel, or root for new ones
      const targetFile = wf.provenance.channels[ch.id];
      if (targetFile) {
        updateInFile(targetFile, 'channels', ch.id, def);
      } else {
        wf.channels[ch.id] = def;
        newChannelsAdded = true;
      }
      written.push(ch.id);
    }
  }

  // Pull roles — from platform API if Zoon-hosted, from tenant if self-hosted
  let newRolesAdded = false;
  try {
    const server = resolveServer();
    const file = loadConfigFile();
    const entry = server ? file.servers?.[server] : undefined;
    let roles: Array<{
      id: string;
      name?: string;
      description?: string;
      scopes: string[];
    }>;

    if (server && isZoonHosted(server) && entry?.platform_token) {
      // Zoon-hosted: roles live on the platform
      roles = await listRolesFromZoon(server, entry.platform_token);
    } else {
      // Self-hosted: roles live on the tenant
      roles = await c.listRoles();
    }

    if (roles.length > 0) {
      printStep('Pulling roles...');

      for (const role of roles) {
        const def: RoleDef = { scopes: role.scopes };
        if (role.name) def.name = role.name;
        if (role.description) def.description = role.description;

        const targetFile = wf.provenance.roles[role.id];
        if (targetFile) {
          updateInFile(targetFile, 'roles', role.id, def);
        } else {
          wf.roles[role.id] = def;
          newRolesAdded = true;
        }
      }
    }
  } catch {
    // Server may not support roles endpoint yet — skip silently
  }

  // Save root workforce.json for any new resources
  if (newChannelsAdded || newRolesAdded) {
    saveWorkforce(wf);
  }

  if (written.length > 0 || Object.keys(wf.roles).length > 0) {
    printSuccess(
      `Pulled ${written.length} channel(s) and ${Object.keys(wf.roles).length} role(s) into .zooid/workforce.json`,
    );
  } else {
    printInfo('Nothing to pull', 'no channels or roles on server');
  }

  return written;
}
