import { loadWorkforce } from './workforce';

export interface ChannelDef {
  name?: string;
  description?: string;
  visibility: 'public' | 'private';
  config?: Record<string, unknown>;
}

/** Load all channel definitions from .zooid/workforce.json */
export function loadChannelDefs(): Map<string, ChannelDef> {
  const wf = loadWorkforce();
  return new Map(Object.entries(wf.channels));
}
