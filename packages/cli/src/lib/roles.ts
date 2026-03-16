import fs from 'node:fs';
import path from 'node:path';
import { getZooidDir } from './project';

export interface RoleDef {
  name?: string;
  description?: string;
  scopes: string[];
}

/** Load all role definitions from .zooid/roles/ directory. */
export function loadRoleDefs(): Map<string, RoleDef> {
  let zooidDir: string;
  try {
    zooidDir = getZooidDir();
  } catch {
    return new Map();
  }

  const rolesDir = path.join(zooidDir, 'roles');
  if (!fs.existsSync(rolesDir)) return new Map();

  const defs = new Map<string, RoleDef>();
  for (const file of fs.readdirSync(rolesDir)) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(rolesDir, file), 'utf-8');
    defs.set(id, JSON.parse(raw) as RoleDef);
  }

  return defs;
}

/**
 * Convert role definitions to ZOOID_SCOPE_MAPPING JSON string.
 * Format: { "roleName": ["scope1", "scope2"], ... }
 */
export function rolesToScopeMapping(roles: Map<string, RoleDef>): string {
  const mapping: Record<string, string[]> = {};
  for (const [id, def] of roles) {
    mapping[id] = def.scopes;
  }
  return JSON.stringify(mapping);
}
