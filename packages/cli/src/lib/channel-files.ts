import fs from 'node:fs';
import path from 'node:path';
import { getZooidDir } from './project';
import type { ChannelDef } from './channels';

/** Write a channel definition to .zooid/channels/<id>.json */
export function writeChannelFile(
  id: string,
  def: Partial<ChannelDef> & { visibility: ChannelDef['visibility'] },
): void {
  const channelsDir = path.join(getZooidDir(), 'channels');
  fs.mkdirSync(channelsDir, { recursive: true });
  fs.writeFileSync(
    path.join(channelsDir, `${id}.json`),
    JSON.stringify(def, null, 2) + '\n',
  );
}

/** Read a channel definition from .zooid/channels/<id>.json, or null if missing. */
export function readChannelFile(id: string): ChannelDef | null {
  try {
    const filePath = path.join(getZooidDir(), 'channels', `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ChannelDef;
  } catch {
    return null;
  }
}

/** Delete .zooid/channels/<id>.json. Throws if not found. */
export function deleteChannelFile(id: string): void {
  const filePath = path.join(getZooidDir(), 'channels', `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Channel "${id}" not found in .zooid/channels/`);
  }
  fs.unlinkSync(filePath);
}

/** List all channel IDs from .zooid/channels/*.json filenames. */
export function listChannelFiles(): string[] {
  try {
    const channelsDir = path.join(getZooidDir(), 'channels');
    if (!fs.existsSync(channelsDir)) return [];
    return fs
      .readdirSync(channelsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
