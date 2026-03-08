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
  return c.updateChannel(channelId, options);
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
}
