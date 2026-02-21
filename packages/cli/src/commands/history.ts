import { loadConfigFile } from '../lib/config';

export interface HistoryEntry {
  server: string;
  channel_id: string;
  name?: string;
  num_tails: number;
  last_tailed_at: string;
  first_tailed_at: string;
}

/** Collect all channels with tail/subscribe stats across all servers. */
export function runHistory(): HistoryEntry[] {
  const file = loadConfigFile();
  const entries: HistoryEntry[] = [];

  if (!file.servers) return entries;

  for (const [serverUrl, serverConfig] of Object.entries(file.servers)) {
    if (!serverConfig.channels) continue;
    for (const [channelId, channelData] of Object.entries(
      serverConfig.channels,
    )) {
      if (channelData.stats) {
        entries.push({
          server: serverUrl,
          channel_id: channelId,
          name: channelData.name,
          num_tails: channelData.stats.num_tails,
          last_tailed_at: channelData.stats.last_tailed_at,
          first_tailed_at: channelData.stats.first_tailed_at,
        });
      }
    }
  }

  // Most recently tailed first
  entries.sort(
    (a, b) =>
      new Date(b.last_tailed_at).getTime() -
      new Date(a.last_tailed_at).getTime(),
  );

  return entries;
}
