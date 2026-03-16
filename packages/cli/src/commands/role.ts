import {
  writeRoleFile,
  readRoleFile,
  deleteRoleFile,
  listRoleFiles,
} from '../lib/role-files';
import type { RoleDef } from '../lib/roles';

/** Create a role definition file in .zooid/roles/<id>.json */
export function runRoleCreate(
  id: string,
  options: { name?: string; description?: string; scopes: string[] },
): void {
  const existing = readRoleFile(id);
  if (existing) {
    throw new Error(
      `Role "${id}" already exists in .zooid/roles/. Use "zooid role update" to modify it.`,
    );
  }

  const def: RoleDef = { scopes: options.scopes };
  if (options.name) def.name = options.name;
  if (options.description) def.description = options.description;

  writeRoleFile(id, def);
}

/** List all local role IDs from .zooid/roles/ */
export function runRoleList(): string[] {
  return listRoleFiles();
}

/** Update fields in an existing .zooid/roles/<id>.json */
export function runRoleUpdate(
  id: string,
  fields: {
    name?: string | null;
    description?: string | null;
    scopes?: string[];
  },
): RoleDef {
  const existing = readRoleFile(id);
  if (!existing) {
    throw new Error(
      `Role "${id}" not found in .zooid/roles/. Use "zooid role create" first.`,
    );
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

  writeRoleFile(id, existing);
  return existing;
}

/** Delete .zooid/roles/<id>.json */
export function runRoleDelete(id: string): void {
  deleteRoleFile(id);
}
