import type { TrustedKeyRow } from '../types';

/**
 * Load trusted keys from D1.
 *
 * No caching — the trusted_keys table is max 16 rows and D1 reads
 * are co-located I/O (don't count against CPU limit). If this becomes
 * a latency concern, add a KV cache layer here without changing callers.
 */

export async function getTrustedKeysFromCache(
  db: D1Database,
): Promise<Map<string, TrustedKeyRow>> {
  const result = await db
    .prepare('SELECT * FROM trusted_keys')
    .all<TrustedKeyRow>();
  return new Map(result.results.map((r) => [r.kid, r]));
}
