import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { parseGitHubUrl } from './github';

export interface TemplateFetchOptions {
  fetch?: typeof globalThis.fetch;
}

export interface TemplateFetchResult {
  channelCount: number;
  roleCount: number;
}

/**
 * Fetch a Zooid template from a GitHub URL into the target directory.
 * Downloads the repo as a tarball, extracts .zooid/ (channels + roles).
 */
export async function fetchTemplate(
  url: string,
  targetDir: string,
  options?: TemplateFetchOptions,
): Promise<TemplateFetchResult> {
  const parts = parseGitHubUrl(url);
  if (!parts) {
    throw new Error(
      'Only GitHub URLs are supported. Use https://github.com/owner/repo or https://github.com/owner/repo/tree/ref/path',
    );
  }

  const fetchFn = options?.fetch ?? globalThis.fetch;
  const tarballUrl = `https://api.github.com/repos/${parts.owner}/${parts.repo}/tarball/${parts.ref}`;

  const res = await fetchFn(tarballUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'zooid-cli',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch template from GitHub: HTTP ${res.status}`);
  }

  // Write tarball to temp file
  const tmpTarball = path.join(
    os.tmpdir(),
    `zooid-template-${Date.now()}.tar.gz`,
  );
  const arrayBuffer = await res.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  if (buffer.byteLength === 0) {
    throw new Error(
      "This doesn't look like a Zooid template (no .zooid/channels/ or .zooid/roles/ found)",
    );
  }

  fs.writeFileSync(tmpTarball, new Uint8Array(buffer));

  try {
    // Extract tarball to temp directory
    const tmpExtract = fs.mkdtempSync(
      path.join(os.tmpdir(), 'zooid-template-extract-'),
    );

    execSync(`tar xzf "${tmpTarball}" -C "${tmpExtract}"`, {
      stdio: 'pipe',
    });

    // GitHub tarballs have a top-level directory like "owner-repo-sha/"
    const entries = fs.readdirSync(tmpExtract);
    const topDir = entries[0];
    if (!topDir) {
      throw new Error('Empty tarball');
    }

    const extractRoot = path.join(tmpExtract, topDir);

    // If the URL had a subpath, drill into it
    const sourceRoot = parts.path
      ? path.join(extractRoot, parts.path)
      : extractRoot;

    if (!fs.existsSync(sourceRoot)) {
      throw new Error(
        `Path "${parts.path}" not found in ${parts.owner}/${parts.repo}`,
      );
    }

    // Copy .zooid/ if it exists
    const sourceZooid = path.join(sourceRoot, '.zooid');
    const targetZooid = path.join(targetDir, '.zooid');

    let channelCount = 0;
    let roleCount = 0;

    if (fs.existsSync(sourceZooid)) {
      copyDirSync(sourceZooid, targetZooid);

      const channelsDir = path.join(targetZooid, 'channels');
      if (fs.existsSync(channelsDir)) {
        channelCount = fs
          .readdirSync(channelsDir)
          .filter((f) => f.endsWith('.json')).length;
      }

      const rolesDir = path.join(targetZooid, 'roles');
      if (fs.existsSync(rolesDir)) {
        roleCount = fs
          .readdirSync(rolesDir)
          .filter((f) => f.endsWith('.json')).length;
      }
    }

    // Copy zooid.json if it exists and target doesn't have one
    const sourceConfig = path.join(sourceRoot, 'zooid.json');
    const targetConfig = path.join(targetDir, 'zooid.json');
    if (fs.existsSync(sourceConfig) && !fs.existsSync(targetConfig)) {
      fs.copyFileSync(sourceConfig, targetConfig);
    }

    // Cleanup
    fs.rmSync(tmpExtract, { recursive: true, force: true });

    if (channelCount === 0 && roleCount === 0) {
      throw new Error(
        "This doesn't look like a Zooid template (no .zooid/channels/ or .zooid/roles/ found)",
      );
    }

    return { channelCount, roleCount };
  } finally {
    fs.rmSync(tmpTarball, { force: true });
  }
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
