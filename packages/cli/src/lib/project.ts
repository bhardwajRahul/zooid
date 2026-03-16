import fs from 'node:fs';
import path from 'node:path';

/**
 * Walk up the directory tree to find a Zooid project root.
 * A project root is a directory containing `zooid.json` or `.zooid/`.
 * Returns the absolute path or null if not found.
 */
export function findProjectRoot(from?: string): string | null {
  let dir = fs.realpathSync(from ?? process.cwd());

  while (true) {
    if (
      fs.existsSync(path.join(dir, 'zooid.json')) ||
      fs.existsSync(path.join(dir, '.zooid'))
    ) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null; // hit filesystem root
    dir = parent;
  }
}

/**
 * Get the .zooid/ directory path. Throws if not in a Zooid project.
 */
export function getZooidDir(from?: string): string {
  const root = findProjectRoot(from);
  if (!root) {
    throw new Error(
      'Not a Zooid project (no zooid.json or .zooid/ found). Run `npx zooid init` first.',
    );
  }
  return path.join(root, '.zooid');
}
