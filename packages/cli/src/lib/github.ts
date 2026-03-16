export interface GitHubUrlParts {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

/**
 * Parse a GitHub URL into owner, repo, ref, and path.
 * Supports:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/ref/path/to/dir
 */
export function parseGitHubUrl(url: string): GitHubUrlParts | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;

    const parts = u.pathname.replace(/^\/|\/$/g, '').split('/');
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) return null;

    // https://github.com/owner/repo
    if (parts.length === 2) {
      return { owner, repo, ref: 'main', path: '' };
    }

    // https://github.com/owner/repo/tree/ref/path...
    if (parts[2] === 'tree' && parts.length >= 4) {
      const ref = parts[3];
      const subPath = parts.slice(4).join('/');
      return { owner, repo, ref, path: subPath };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Build the GitHub API URL to download a tarball for a repo at a given ref.
 */
export function buildTarballUrl(parts: GitHubUrlParts): string {
  return `https://api.github.com/repos/${parts.owner}/${parts.repo}/tarball/${parts.ref}`;
}

/**
 * Build the raw content URL for a single file.
 */
export function buildRawUrl(parts: GitHubUrlParts, filePath: string): string {
  const fullPath = parts.path ? `${parts.path}/${filePath}` : filePath;
  return `https://raw.githubusercontent.com/${parts.owner}/${parts.repo}/${parts.ref}/${fullPath}`;
}
