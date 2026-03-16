import fs from 'node:fs';
import path from 'node:path';
import { getZooidDir } from './project';

export interface ChannelDef {
  name?: string;
  description?: string;
  visibility: 'public' | 'private';
  config?: Record<string, unknown>;
}

/** Load all channel definitions from .zooid/channels/ directory. */
export function loadChannelDefs(): Map<string, ChannelDef> {
  let zooidDir: string;
  try {
    zooidDir = getZooidDir();
  } catch {
    return new Map();
  }

  const channelsDir = path.join(zooidDir, 'channels');
  if (!fs.existsSync(channelsDir)) return new Map();

  const defs = new Map<string, ChannelDef>();
  for (const file of fs.readdirSync(channelsDir)) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(channelsDir, file), 'utf-8');
    defs.set(id, JSON.parse(raw) as ChannelDef);
  }

  return defs;
}
