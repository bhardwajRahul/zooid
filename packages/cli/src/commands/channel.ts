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
import { writeChannelFile, deleteChannelFile } from '../lib/channel-files';
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
    is_public: options.public ?? true,
    config,
  });

  // Save token to config (only when using real config, not injected client)
  if (!client) {
    const config = loadConfig();
    const channels = config.channels ?? {};
    channels[id] = { token: result.token };
    saveConfig({ channels });
  }

  // Write local .zooid/channels/ file (best-effort — skip if not in a project)
  if (findProjectRoot()) {
    try {
      writeChannelFile(id, {
        visibility: options.public === false ? 'private' : 'public',
        ...(options.name && { name: options.name }),
        ...(options.description && { description: options.description }),
        ...(config && { config }),
      });
    } catch {
      // Not in a zooid project or .zooid/ doesn't exist — skip silently
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

  // Update local .zooid/channels/ file (best-effort)
  if (findProjectRoot()) {
    try {
      writeChannelFile(channelId, {
        visibility: result.is_public ? 'public' : 'private',
        ...(result.name && result.name !== channelId && { name: result.name }),
        ...(result.description && { description: result.description }),
        ...(result.config && { config: result.config }),
      });
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

  // Delete local .zooid/channels/ file (best-effort)
  if (findProjectRoot()) {
    try {
      deleteChannelFile(channelId);
    } catch {
      // File may not exist locally — skip silently
    }
  }
}
