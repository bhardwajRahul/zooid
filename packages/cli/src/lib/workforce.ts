import fs from 'node:fs';
import path from 'node:path';
import { getZooidDir } from './project';
import type { ChannelDef } from './channels';
import type { RoleDef } from './roles';

export interface AgentDef {
  name?: string;
  description?: string;
  publishes?: string[];
  subscribes?: string[];
}

export interface WorkforceMeta {
  name?: string;
  slug?: string;
  description?: string;
  tags?: string[];
}

export interface WorkforceFile {
  $schema?: string;
  meta?: WorkforceMeta;
  include?: string[];
  channels?: Record<string, ChannelDef>;
  roles?: Record<string, RoleDef>;
  agents?: Record<string, AgentDef>;
}

const WORKFORCE_FILENAME = 'workforce.json';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

/**
 * Validate a parsed workforce file. Throws with file path context on error.
 */
export function validateWorkforceFile(
  raw: Record<string, unknown>,
  filePath: string,
): void {
  // meta.slug
  if (raw.meta && typeof raw.meta === 'object') {
    const meta = raw.meta as Record<string, unknown>;
    if (meta.slug !== undefined) {
      if (typeof meta.slug !== 'string' || !isValidSlug(meta.slug)) {
        throw new Error(
          `Invalid meta.slug in ${filePath}: "${meta.slug}" — must be a valid slug (lowercase alphanumeric + hyphens, 3-64 chars)`,
        );
      }
    }
  }

  // include paths
  if (raw.include) {
    if (!Array.isArray(raw.include)) {
      throw new Error(`"include" must be an array in ${filePath}`);
    }
    for (const p of raw.include) {
      if (typeof p !== 'string') {
        throw new Error(`Include entries must be strings in ${filePath}`);
      }
      if (path.isAbsolute(p)) {
        throw new Error(`Include path must be relative in ${filePath}: ${p}`);
      }
    }
  }

  // channels
  if (raw.channels && typeof raw.channels === 'object') {
    for (const [id, ch] of Object.entries(
      raw.channels as Record<string, unknown>,
    )) {
      if (!isValidSlug(id)) {
        throw new Error(
          `Invalid channel slug "${id}" in ${filePath} — must be lowercase alphanumeric + hyphens, 3-64 chars`,
        );
      }
      if (
        !ch ||
        typeof ch !== 'object' ||
        !(ch as Record<string, unknown>).visibility
      ) {
        throw new Error(
          `Channel "${id}" in ${filePath} must have a "visibility" field`,
        );
      }
    }
  }

  // roles
  if (raw.roles && typeof raw.roles === 'object') {
    for (const [id, role] of Object.entries(
      raw.roles as Record<string, unknown>,
    )) {
      if (!isValidSlug(id)) {
        throw new Error(
          `Invalid role slug "${id}" in ${filePath} — must be lowercase alphanumeric + hyphens, 3-64 chars`,
        );
      }
      if (
        !role ||
        typeof role !== 'object' ||
        !Array.isArray((role as Record<string, unknown>).scopes)
      ) {
        throw new Error(
          `Role "${id}" in ${filePath} must have a "scopes" array`,
        );
      }
    }
  }
}

// --- Include Resolution ---

interface ResolvedWorkforce {
  channels: Record<string, ChannelDef>;
  roles: Record<string, RoleDef>;
  agents: Record<string, AgentDef>;
  provenance: {
    channels: Record<string, string>;
    roles: Record<string, string>;
    agents: Record<string, string>;
  };
}

/**
 * Recursively resolve include chains, merging channels/roles/agents.
 * Depth-first: included files are loaded before the declaring file.
 * Later entries win on key collision.
 *
 * `ancestors` tracks the current include chain for cycle detection.
 * It's copied per branch, so diamond includes (A includes B and C,
 * both include D) are allowed — D is loaded twice and last-wins
 * applies. This is intentional: it's simpler and more flexible
 * than deduplicating a DAG.
 *
 * `isRoot` indicates whether this is the root workforce.json.
 * Collisions between non-root files emit warnings.
 */
function resolveIncludes(
  filePath: string,
  ancestors: Set<string>,
  isRoot = false,
): ResolvedWorkforce {
  const realPath = fs.realpathSync(filePath);
  if (ancestors.has(realPath)) {
    const chain = [...ancestors, realPath]
      .map((p) => path.basename(p))
      .join(' → ');
    throw new Error(`Circular include: ${chain}`);
  }
  const childAncestors = new Set(ancestors);
  childAncestors.add(realPath);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
    string,
    unknown
  >;
  validateWorkforceFile(raw, filePath);

  const wf = raw as unknown as WorkforceFile;
  const baseDir = path.dirname(filePath);

  const result: ResolvedWorkforce = {
    channels: {},
    roles: {},
    agents: {},
    provenance: { channels: {}, roles: {}, agents: {} },
  };

  // Resolve includes first (depth-first, in order)
  if (wf.include) {
    for (const includePath of wf.include) {
      const resolved = path.resolve(baseDir, includePath);

      // Verify the resolved path stays within .zooid/
      try {
        const zooidDir = getZooidDir();
        const realZooidDir = fs.realpathSync(zooidDir);
        if (
          !resolved.startsWith(realZooidDir + path.sep) &&
          resolved !== realZooidDir
        ) {
          throw new Error(
            `Include path escapes .zooid/ in ${filePath}: ${includePath}`,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('escapes')) throw e;
        // getZooidDir() failed — skip containment check
      }

      if (!fs.existsSync(resolved)) {
        throw new Error(
          `Included file not found: ${includePath} (resolved to ${resolved})`,
        );
      }

      const included = resolveIncludes(resolved, childAncestors);

      // Warn on collisions between non-root included files
      if (!isRoot) {
        for (const id of Object.keys(included.channels)) {
          if (id in result.channels) {
            const prev = path.basename(result.provenance.channels[id]);
            const curr = path.basename(included.provenance.channels[id]);
            console.warn(
              `⚠ Channel "${id}" defined in both ${prev} and ${curr} — using ${curr} (last wins)`,
            );
          }
        }
        for (const id of Object.keys(included.roles)) {
          if (id in result.roles) {
            const prev = path.basename(result.provenance.roles[id]);
            const curr = path.basename(included.provenance.roles[id]);
            console.warn(
              `⚠ Role "${id}" defined in both ${prev} and ${curr} — using ${curr} (last wins)`,
            );
          }
        }
      }

      Object.assign(result.channels, included.channels);
      Object.assign(result.roles, included.roles);
      Object.assign(result.agents, included.agents);
      Object.assign(result.provenance.channels, included.provenance.channels);
      Object.assign(result.provenance.roles, included.provenance.roles);
      Object.assign(result.provenance.agents, included.provenance.agents);
    }
  }

  // Layer this file's own definitions on top (declaring file wins)
  if (wf.channels) {
    for (const [id, def] of Object.entries(wf.channels)) {
      result.channels[id] = def;
      result.provenance.channels[id] = filePath;
    }
  }
  if (wf.roles) {
    for (const [id, def] of Object.entries(wf.roles)) {
      result.roles[id] = def;
      result.provenance.roles[id] = filePath;
    }
  }
  if (wf.agents) {
    for (const [id, def] of Object.entries(wf.agents)) {
      result.agents[id] = def;
      result.provenance.agents[id] = filePath;
    }
  }

  return result;
}

// --- Public API ---

export interface LoadWorkforceResult {
  channels: Record<string, ChannelDef>;
  roles: Record<string, RoleDef>;
  provenance: {
    channels: Record<string, string>;
    roles: Record<string, string>;
  };
}

/**
 * Load the workforce file from .zooid/workforce.json.
 * Resolves includes recursively, compiles agents to roles after merge.
 * Returns empty channels/roles if file doesn't exist.
 */
export function loadWorkforce(): LoadWorkforceResult {
  let zooidDir: string;
  try {
    zooidDir = getZooidDir();
  } catch {
    return {
      channels: {},
      roles: {},
      provenance: { channels: {}, roles: {} },
    };
  }

  const filePath = path.join(zooidDir, WORKFORCE_FILENAME);
  if (!fs.existsSync(filePath)) {
    return {
      channels: {},
      roles: {},
      provenance: { channels: {}, roles: {} },
    };
  }

  // Resolve includes recursively
  const resolved = resolveIncludes(filePath, new Set(), true);

  // Compile agents to roles AFTER merge (cross-file channel refs work)
  if (Object.keys(resolved.agents).length > 0) {
    // Check for name collisions
    for (const agentId of Object.keys(resolved.agents)) {
      if (agentId in resolved.roles) {
        throw new Error(
          `agent "${agentId}" collides with a role of the same name. Use one or the other.`,
        );
      }
    }
    const derivedRoles = compileAgents(resolved.agents);
    Object.assign(resolved.roles, derivedRoles);
    // Provenance for compiled roles points to the file that defined the agent
    for (const id of Object.keys(derivedRoles)) {
      resolved.provenance.roles[id] =
        resolved.provenance.agents[id] ?? filePath;
    }
  }

  return {
    channels: resolved.channels,
    roles: resolved.roles,
    provenance: resolved.provenance,
  };
}

export interface SaveWorkforceOptions {
  targetFile?: string;
}

/**
 * Save channels and roles to a workforce file.
 * Preserves $schema, meta, include, and agents from the existing file.
 * Defaults to root .zooid/workforce.json if no targetFile specified.
 */
export function saveWorkforce(
  data: {
    channels: Record<string, ChannelDef>;
    roles: Record<string, RoleDef>;
  },
  options?: SaveWorkforceOptions,
): void {
  let filePath: string;

  if (options?.targetFile) {
    filePath = options.targetFile;
  } else {
    let zooidDir: string;
    try {
      zooidDir = getZooidDir();
    } catch {
      // No project root — create .zooid/ in cwd
      zooidDir = path.join(process.cwd(), '.zooid');
    }
    fs.mkdirSync(zooidDir, { recursive: true });
    filePath = path.join(zooidDir, WORKFORCE_FILENAME);
  }

  // Read existing file to preserve non-workforce fields
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  const output: Record<string, unknown> = {};

  // Preserve $schema, meta, include, agents
  if (existing.$schema) output.$schema = existing.$schema;
  if (existing.meta) output.meta = existing.meta;
  if (existing.include) output.include = existing.include;

  output.channels = data.channels;
  output.roles = data.roles;

  if (existing.agents) output.agents = existing.agents;

  fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + '\n');
}

/**
 * Update a single channel or role in the file that owns it.
 * Preserves all other fields in the file.
 */
export function updateInFile(
  filePath: string,
  section: 'channels' | 'roles',
  id: string,
  def: ChannelDef | RoleDef,
): void {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!raw[section]) raw[section] = {};
  raw[section][id] = def;
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
}

/**
 * Remove a single channel or role from the file that owns it.
 * Preserves all other fields in the file.
 */
export function removeFromFile(
  filePath: string,
  section: 'channels' | 'roles',
  id: string,
): void {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (raw[section]) {
    delete raw[section][id];
  }
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
}

/**
 * Compile agent definitions into role definitions.
 * publishes: ["X"] → pub:X scope
 * subscribes: ["X"] → sub:X scope
 */
export function compileAgents(
  agents: Record<string, AgentDef>,
): Record<string, RoleDef> {
  const roles: Record<string, RoleDef> = {};

  for (const [id, agent] of Object.entries(agents)) {
    const scopes: string[] = [];

    if (agent.subscribes) {
      for (const ch of agent.subscribes) {
        scopes.push(`sub:${ch}`);
      }
    }
    if (agent.publishes) {
      for (const ch of agent.publishes) {
        scopes.push(`pub:${ch}`);
      }
    }

    const role: RoleDef = { scopes };
    if (agent.name) role.name = agent.name;
    if (agent.description) role.description = agent.description;

    roles[id] = role;
  }

  return roles;
}
