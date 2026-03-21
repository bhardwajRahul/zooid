import { loadWorkforce } from './workforce';

export interface RoleDef {
  name?: string;
  description?: string;
  scopes: string[];
}

/** Load all role definitions from .zooid/workforce.json (includes compiled agents). */
export function loadRoleDefs(): Map<string, RoleDef> {
  const wf = loadWorkforce();
  return new Map(Object.entries(wf.roles));
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
