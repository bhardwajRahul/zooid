#!/usr/bin/env node
/**
 * Fix corrupt ~/.zooid/config.json entries caused by the old parseChannelUrl bug.
 *
 * What it fixes:
 *  1. Channel IDs that are actually URLs (e.g. "beno.zooid.dev/daily-haiku"
 *     or "localhost:8787/daily-haiku" stored as channel IDs) — re-parses them
 *     and moves stats to the correct server + channel.
 *  2. Duplicate http/https server entries for the same host — merges stats
 *     into the canonical (https for public, http for localhost/private IPs).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const configDir =
  process.env.ZOOID_CONFIG_DIR ?? path.join(os.homedir(), '.zooid');
const configPath = path.join(configDir, 'config.json');

// --- helpers ---

const PRIVATE_IP_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function isPrivateHost(hostname) {
  return PRIVATE_IP_RE.test(hostname);
}

/** Try to parse a channel ID that is actually a URL. Returns null if it's a normal channel ID. */
function parseChannelIdAsUrl(channelId) {
  if (!channelId.includes('/')) return null;

  let raw = channelId;
  if (!raw.startsWith('http')) {
    if (
      /^localhost(:\d+)?\//.test(raw) ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\//.test(raw)
    ) {
      raw = `http://${raw}`;
    } else if (raw.includes('.')) {
      raw = `https://${raw}`;
    } else {
      return null;
    }
  }

  try {
    const url = new URL(raw);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 1) {
      return { server: url.origin, channelId: segments[0] };
    }
    const channelsMatch = url.pathname.match(/^\/channels\/([^/]+)/);
    if (channelsMatch) {
      return { server: url.origin, channelId: channelsMatch[1] };
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** Canonical server URL: https for public hosts, http for private/localhost. */
function canonicalServerUrl(serverUrl) {
  let normalized = serverUrl.replace(/\/+$/, '');
  try {
    const url = new URL(normalized);
    if (isPrivateHost(url.hostname)) {
      normalized = normalized.replace(/^https:\/\//, 'http://');
    } else {
      normalized = normalized.replace(/^http:\/\//, 'https://');
    }
  } catch {
    /* leave as-is */
  }
  return normalized;
}

function mergeStats(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return { ...incoming };
  return {
    num_tails: existing.num_tails + incoming.num_tails,
    last_tailed_at:
      existing.last_tailed_at > incoming.last_tailed_at
        ? existing.last_tailed_at
        : incoming.last_tailed_at,
    first_tailed_at:
      existing.first_tailed_at < incoming.first_tailed_at
        ? existing.first_tailed_at
        : incoming.first_tailed_at,
  };
}

function mergeChannel(existing, incoming) {
  const merged = { ...existing };
  // Keep tokens from the existing entry (don't overwrite with nothing)
  if (incoming.publish_token && !merged.publish_token)
    merged.publish_token = incoming.publish_token;
  if (incoming.subscribe_token && !merged.subscribe_token)
    merged.subscribe_token = incoming.subscribe_token;
  if (incoming.name && !merged.name) merged.name = incoming.name;
  merged.stats = mergeStats(merged.stats, incoming.stats);
  return merged;
}

// --- main ---

if (!fs.existsSync(configPath)) {
  console.log('No config file found at', configPath);
  process.exit(0);
}

const raw = fs.readFileSync(configPath, 'utf-8');
const config = JSON.parse(raw);

if (!config.servers) {
  console.log('No servers in config — nothing to fix.');
  process.exit(0);
}

// Back up first
const backupPath = configPath + '.bak';
fs.copyFileSync(configPath, backupPath);
console.log(`Backed up to ${backupPath}\n`);

let fixes = 0;

// Pass 1: Fix channel IDs that are actually URLs
for (const [serverUrl, serverConfig] of Object.entries(config.servers)) {
  if (!serverConfig.channels) continue;

  const badKeys = [];
  for (const [channelId, channelData] of Object.entries(
    serverConfig.channels,
  )) {
    const parsed = parseChannelIdAsUrl(channelId);
    if (!parsed) continue;

    badKeys.push(channelId);
    const targetServer = parsed.server;
    const targetChannel = parsed.channelId;

    console.log(`  Channel ID "${channelId}" under ${serverUrl}`);
    console.log(
      `    → moving to server ${targetServer}, channel "${targetChannel}"`,
    );

    // Ensure target server exists
    if (!config.servers[targetServer]) config.servers[targetServer] = {};
    if (!config.servers[targetServer].channels)
      config.servers[targetServer].channels = {};

    const existing = config.servers[targetServer].channels[targetChannel] ?? {};
    config.servers[targetServer].channels[targetChannel] = mergeChannel(
      existing,
      channelData,
    );
    fixes++;
  }

  for (const key of badKeys) {
    delete serverConfig.channels[key];
  }
}

// Pass 2: Merge duplicate http/https server entries
const canonicalMap = new Map(); // canonical URL → first raw URL seen
const dupes = []; // raw URLs to merge away

for (const serverUrl of Object.keys(config.servers)) {
  const canonical = canonicalServerUrl(serverUrl);
  if (canonicalMap.has(canonical)) {
    dupes.push({ from: serverUrl, to: canonicalMap.get(canonical) });
  } else {
    canonicalMap.set(canonical, serverUrl);
  }
}

for (const { from, to } of dupes) {
  const source = config.servers[from];
  const target = config.servers[to];

  console.log(`  Duplicate server "${from}"`);
  console.log(`    → merging into "${to}"`);

  // Merge server-level fields (keep target's tokens/worker_url)
  if (source.admin_token && !target.admin_token)
    target.admin_token = source.admin_token;
  if (source.worker_url && !target.worker_url)
    target.worker_url = source.worker_url;

  // Merge channels
  if (source.channels) {
    if (!target.channels) target.channels = {};
    for (const [chId, chData] of Object.entries(source.channels)) {
      const existing = target.channels[chId] ?? {};
      target.channels[chId] = mergeChannel(existing, chData);
    }
  }

  delete config.servers[from];
  fixes++;

  // Fix `current` if it pointed to the removed entry
  if (config.current === from) {
    config.current = to;
    console.log(`    → updated "current" to "${to}"`);
  }
}

if (fixes === 0) {
  console.log('Config looks clean — nothing to fix.');
  fs.unlinkSync(backupPath);
} else {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(
    `\nFixed ${fixes} issue${fixes === 1 ? '' : 's'}. Backup at ${backupPath}`,
  );
}
