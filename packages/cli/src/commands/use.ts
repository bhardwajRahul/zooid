import fs from 'node:fs';
import path from 'node:path';
import { getZooidDir } from '../lib/project';
import { parseGitHubUrl } from '../lib/github';
import { printSuccess, printStep, printInfo } from '../lib/output';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/**
 * Derive a template name from a GitHub URL.
 * Uses the last path segment, or the repo name if no subpath.
 */
export function deriveTemplateName(url: string): string {
  const parts = parseGitHubUrl(url);
  if (!parts) throw new Error('Cannot derive template name from URL');

  if (parts.path) {
    const segments = parts.path.split('/').filter(Boolean);
    return segments[segments.length - 1];
  }

  return parts.repo;
}

/**
 * Resolve the directory name for a template.
 * Prefers meta.slug from the template's workforce.json, falls back to URL.
 * Validates slug format.
 */
export function resolveTemplateName(
  url: string,
  workforce: Record<string, unknown>,
): string {
  const meta = workforce.meta as Record<string, unknown> | undefined;
  if (meta?.slug) {
    const slug = meta.slug as string;
    if (!SLUG_RE.test(slug)) {
      throw new Error(
        `Invalid meta.slug "${slug}" — must be lowercase alphanumeric + hyphens, 3-64 chars`,
      );
    }
    return slug;
  }

  return deriveTemplateName(url);
}

/**
 * Add an include entry to workforce.json.
 * Creates the file and include array if they don't exist.
 * Deduplicates entries. Preserves all existing fields.
 */
export function addToInclude(relativePath: string): void {
  const zooidDir = getZooidDir();
  const workforcePath = path.join(zooidDir, 'workforce.json');

  let raw: Record<string, unknown>;
  if (fs.existsSync(workforcePath)) {
    raw = JSON.parse(fs.readFileSync(workforcePath, 'utf-8'));
  } else {
    raw = { channels: {}, roles: {} };
  }

  const include = (raw.include as string[]) ?? [];
  if (!include.includes(relativePath)) {
    include.push(relativePath);
  }
  raw.include = include;

  fs.writeFileSync(workforcePath, JSON.stringify(raw, null, 2) + '\n');
}

export interface UseOptions {
  fetch?: typeof globalThis.fetch;
}

/**
 * Fetch a template and add it as an included workforce directory.
 *
 * 1. Fetch the template repo/subdirectory as a tarball.
 * 2. Read meta.slug from the template's workforce.json for directory name.
 * 3. Copy entire .zooid/ from template into .zooid/<slug>/.
 * 4. Add "./<slug>/workforce.json" to include in root workforce.json.
 */
export async function runUse(url: string, options?: UseOptions): Promise<void> {
  printStep('Fetching template...');

  const zooidDir = getZooidDir();

  // Fetch to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(zooidDir, '.tmp-template-'));

  try {
    const { fetchTemplate } = await import('../lib/template');
    const result = await fetchTemplate(url, tmpDir, {
      fetch: options?.fetch,
    });

    // Read the fetched workforce.json to get meta.slug
    const fetchedZooidDir = path.join(tmpDir, '.zooid');
    const fetchedWorkforce = path.join(fetchedZooidDir, 'workforce.json');

    if (!fs.existsSync(fetchedWorkforce)) {
      throw new Error('Template has no .zooid/workforce.json');
    }

    const wfRaw = JSON.parse(fs.readFileSync(fetchedWorkforce, 'utf-8'));
    const slug = resolveTemplateName(url, wfRaw);

    // Copy entire .zooid/ from template into .zooid/<slug>/
    const targetDir = path.join(zooidDir, slug);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }

    fs.cpSync(fetchedZooidDir, targetDir, { recursive: true });

    // Add to include
    addToInclude(`./${slug}/workforce.json`);

    printSuccess(
      `Saved .zooid/${slug}/ (${result.channelCount} channel(s), ${result.roleCount} role(s))`,
    );
    printInfo('Added to include', 'workforce.json');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
