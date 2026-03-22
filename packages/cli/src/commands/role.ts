import {
  loadWorkforce,
  saveWorkforce,
  updateInFile,
  removeFromFile,
} from '../lib/workforce';
import type { RoleDef } from '../lib/roles';

/** Create a role definition in .zooid/workforce.json */
export function runRoleCreate(
  id: string,
  options: { name?: string; description?: string; scopes: string[] },
): void {
  const wf = loadWorkforce();
  if (id in wf.roles) {
    throw new Error(
      `Role "${id}" already exists. Use "zooid role update" to modify it.`,
    );
  }

  const def: RoleDef = { scopes: options.scopes };
  if (options.name) def.name = options.name;
  if (options.description) def.description = options.description;

  wf.roles[id] = def;
  saveWorkforce(wf);
}

/** List all local role IDs from .zooid/workforce.json */
export function runRoleList(): string[] {
  const wf = loadWorkforce();
  return Object.keys(wf.roles);
}

/** Update fields in an existing role in .zooid/workforce.json */
export function runRoleUpdate(
  id: string,
  fields: {
    name?: string | null;
    description?: string | null;
    scopes?: string[];
  },
): RoleDef {
  const wf = loadWorkforce();
  const existing = wf.roles[id];
  if (!existing) {
    throw new Error(`Role "${id}" not found. Use "zooid role create" first.`);
  }

  if (fields.name !== undefined) {
    if (fields.name === null) {
      delete existing.name;
    } else {
      existing.name = fields.name;
    }
  }
  if (fields.description !== undefined) {
    if (fields.description === null) {
      delete existing.description;
    } else {
      existing.description = fields.description;
    }
  }
  if (fields.scopes !== undefined) {
    existing.scopes = fields.scopes;
  }

  // Write to the file that owns this role (provenance-aware)
  const targetFile = wf.provenance.roles[id];
  if (targetFile) {
    updateInFile(targetFile, 'roles', id, existing);
  } else {
    wf.roles[id] = existing;
    saveWorkforce(wf);
  }
  return existing;
}

/** Delete a role from .zooid/workforce.json */
export function runRoleDelete(id: string): void {
  const wf = loadWorkforce();
  if (!(id in wf.roles)) {
    throw new Error(`Role "${id}" not found in .zooid/workforce.json`);
  }

  // Remove from the file that owns this role (provenance-aware)
  const targetFile = wf.provenance.roles[id];
  if (targetFile) {
    removeFromFile(targetFile, 'roles', id);
  } else {
    delete wf.roles[id];
    saveWorkforce(wf);
  }
}
