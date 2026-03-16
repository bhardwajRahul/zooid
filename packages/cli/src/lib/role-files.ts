import fs from 'node:fs';
import path from 'node:path';
import { getZooidDir } from './project';
import type { RoleDef } from './roles';

/** Write a role definition to .zooid/roles/<id>.json */
export function writeRoleFile(
  id: string,
  def: Partial<RoleDef> & { scopes: string[] },
): void {
  const rolesDir = path.join(getZooidDir(), 'roles');
  fs.mkdirSync(rolesDir, { recursive: true });
  fs.writeFileSync(
    path.join(rolesDir, `${id}.json`),
    JSON.stringify(def, null, 2) + '\n',
  );
}

/** Read a role definition from .zooid/roles/<id>.json, or null if missing. */
export function readRoleFile(id: string): RoleDef | null {
  try {
    const filePath = path.join(getZooidDir(), 'roles', `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RoleDef;
  } catch {
    return null;
  }
}

/** Delete .zooid/roles/<id>.json. Throws if not found. */
export function deleteRoleFile(id: string): void {
  const filePath = path.join(getZooidDir(), 'roles', `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Role "${id}" not found in .zooid/roles/`);
  }
  fs.unlinkSync(filePath);
}

/** List all role IDs from .zooid/roles/*.json filenames. */
export function listRoleFiles(): string[] {
  try {
    const rolesDir = path.join(getZooidDir(), 'roles');
    if (!fs.existsSync(rolesDir)) return [];
    return fs
      .readdirSync(rolesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
