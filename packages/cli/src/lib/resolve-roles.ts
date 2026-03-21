import { loadRoleDefs } from './roles';

/**
 * Resolve role names to a deduplicated array of scopes
 * by reading .zooid/workforce.json locally.
 */
export function resolveRoleScopes(roleNames: string[]): string[] {
  const roles = loadRoleDefs();
  const allScopes = new Set<string>();

  for (const name of roleNames) {
    const role = roles.get(name);
    if (!role) {
      throw new Error(
        `Role "${name}" not found in .zooid/workforce.json. Available: ${[...roles.keys()].join(', ') || '(none)'}`,
      );
    }
    for (const scope of role.scopes) {
      allScopes.add(scope);
    }
  }

  return [...allScopes];
}
