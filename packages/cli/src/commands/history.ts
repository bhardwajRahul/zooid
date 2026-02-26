import { loadConfigFile } from '../lib/config';
import { normalizeServerUrl } from '../lib/client';

export interface HistoryEntry {
  server: string;
  channel_id: string;
  name?: string;
  num_tails: number;
  last_tailed_at: string;
  first_tailed_at: string;
}

/** Collect all channels with tail/subscribe stats. */
export function runHistory(): HistoryEntry[] {
  const file = loadConfigFile();
  const entries: HistoryEntry[] = [];

  if (!file.servers) return entries;

  // Dedupe key: normalized server + channel_id
  const seen = new Map<string, number>();

  for (const [serverUrl, serverConfig] of Object.entries(file.servers)) {
    if (!serverConfig.channels) continue;
    const normalizedServer = normalizeServerUrl(serverUrl);

    for (const [channelId, channelData] of Object.entries(
      serverConfig.channels,
    )) {
      if (!channelData.stats) continue;

      const key = `${normalizedServer}\0${channelId}`;
      const existingIdx = seen.get(key);

      if (existingIdx !== undefined) {
        // Merge: keep the entry with the most recent tail, sum the counts
        const existing = entries[existingIdx];
        existing.num_tails += channelData.stats.num_tails;
        if (channelData.stats.last_tailed_at > existing.last_tailed_at) {
          existing.last_tailed_at = channelData.stats.last_tailed_at;
          existing.name = channelData.name ?? existing.name;
        }
        if (channelData.stats.first_tailed_at < existing.first_tailed_at) {
          existing.first_tailed_at = channelData.stats.first_tailed_at;
        }
      } else {
        seen.set(key, entries.length);
        entries.push({
          server: normalizedServer,
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
