import {
  ZooidClient,
  type CreateChannelResult,
  type UpdateChannelOptions,
  type ChannelInfo,
} from '@zooid/sdk';
import type { ChannelListItem } from '@zooid/types';
import { createClient } from '../lib/client';
import {
  loadConfig,
  loadConfigFile,
  resolveServer,
  getStatePath,
  saveConfig,
} from '../lib/config';
import {
  loadWorkforce,
  saveWorkforce,
  updateInFile,
  removeFromFile,
} from '../lib/workforce';
import { findProjectRoot } from '../lib/project';

export interface ChannelCreateOptions {
  name?: string;
  description?: string;
  public?: boolean;
  strict?: boolean;
  config?: Record<string, unknown>;
}

export async function runChannelCreate(
  id: string,
  options: ChannelCreateOptions,
  client?: ZooidClient,
): Promise<CreateChannelResult> {
  const c = client ?? createClient();
  let config = options.config;
  if (options.strict !== undefined) {
    config = { ...config, strict_types: options.strict };
  }
  const result = await c.createChannel({
    id,
    name: options.name ?? id,
    description: options.description,
    is_public: options.public ?? false,
    config,
  });

  // Save token to config (only when using real config, not injected client)
  if (!client) {
    const config = loadConfig();
    const channels = config.channels ?? {};
    channels[id] = { token: result.token };
    saveConfig({ channels });
  }

  // Write to .zooid/workforce.json (best-effort — skip if not in a project)
  if (findProjectRoot()) {
    try {
      const wf = loadWorkforce();
      wf.channels[id] = {
        visibility: options.public ? 'public' : 'private',
        ...(options.name && { name: options.name }),
        ...(options.description && { description: options.description }),
        ...(config && { config }),
      };
      saveWorkforce(wf);
    } catch {
      // Not in a zooid project — skip silently
    }
  }

  return result;
}

export async function runChannelList(
  client?: ZooidClient,
): Promise<ChannelListItem[]> {
  const c = client ?? createClient();
  return c.listChannels();
}

export async function runChannelUpdate(
  channelId: string,
  options: UpdateChannelOptions,
  client?: ZooidClient,
): Promise<ChannelInfo> {
  const c = client ?? createClient();
  const result = await c.updateChannel(channelId, options);

  // Update .zooid/workforce.json (best-effort, provenance-aware)
  if (findProjectRoot()) {
    try {
      const wf = loadWorkforce();
      const def = {
        visibility: (result.is_public ? 'public' : 'private') as
          | 'public'
          | 'private',
        ...(result.name && result.name !== channelId && { name: result.name }),
        ...(result.description && { description: result.description }),
        ...(result.config && { config: result.config }),
      };
      const targetFile = wf.provenance.channels[channelId];
      if (targetFile) {
        updateInFile(targetFile, 'channels', channelId, def);
      } else {
        wf.channels[channelId] = def;
        saveWorkforce(wf);
      }
    } catch {
      // Skip silently
    }
  }

  return result;
}

export async function runChannelDelete(
  channelId: string,
  client?: ZooidClient,
): Promise<void> {
  const c = client ?? createClient();
  await c.deleteChannel(channelId);

  // Remove channel from local config
  if (!client) {
    const file = loadConfigFile();
    const serverUrl = resolveServer();
    if (serverUrl && file.servers?.[serverUrl]?.channels?.[channelId]) {
      delete file.servers[serverUrl].channels![channelId];
      const fs = await import('node:fs');
      fs.writeFileSync(getStatePath(), JSON.stringify(file, null, 2) + '\n');
    }
  }

  // Remove from .zooid/workforce.json (best-effort, provenance-aware)
  if (findProjectRoot()) {
    try {
      const wf = loadWorkforce();
      const targetFile = wf.provenance.channels[channelId];
      if (targetFile) {
        removeFromFile(targetFile, 'channels', channelId);
      } else {
        delete wf.channels[channelId];
        saveWorkforce(wf);
      }
    } catch {
      // Skip silently
    }
  }
}
