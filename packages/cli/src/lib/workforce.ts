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

export interface WorkforceFile {
  channels?: Record<string, ChannelDef>;
  roles?: Record<string, RoleDef>;
  agents?: Record<string, AgentDef>;
}

const WORKFORCE_FILENAME = 'workforce.json';

/**
 * Load the workforce file from .zooid/workforce.json.
 * If agents are present, compiles them to roles and merges.
 * Returns empty channels/roles if file doesn't exist.
 */
export function loadWorkforce(): {
  channels: Record<string, ChannelDef>;
  roles: Record<string, RoleDef>;
} {
  let zooidDir: string;
  try {
    zooidDir = getZooidDir();
  } catch {
    return { channels: {}, roles: {} };
  }

  const filePath = path.join(zooidDir, WORKFORCE_FILENAME);
  if (!fs.existsSync(filePath)) {
    return { channels: {}, roles: {} };
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WorkforceFile;
  const channels = raw.channels ?? {};
  const explicitRoles = raw.roles ?? {};

  // Compile agents to roles if present
  let derivedRoles: Record<string, RoleDef> = {};
  if (raw.agents && Object.keys(raw.agents).length > 0) {
    // Check for name collisions
    for (const agentId of Object.keys(raw.agents)) {
      if (agentId in explicitRoles) {
        throw new Error(
          `agent "${agentId}" collides with a role of the same name. Use one or the other.`,
        );
      }
    }
    derivedRoles = compileAgents(raw.agents);
  }

  return {
    channels,
    roles: { ...explicitRoles, ...derivedRoles },
  };
}

/**
 * Save channels and roles to .zooid/workforce.json.
 * Only writes channels and roles — never writes agents.
 */
export function saveWorkforce(data: {
  channels: Record<string, ChannelDef>;
  roles: Record<string, RoleDef>;
}): void {
  let zooidDir: string;
  try {
    zooidDir = getZooidDir();
  } catch {
    // No project root — create .zooid/ in cwd
    zooidDir = path.join(process.cwd(), '.zooid');
  }
  fs.mkdirSync(zooidDir, { recursive: true });

  const output: WorkforceFile = {
    channels: data.channels,
    roles: data.roles,
  };

  fs.writeFileSync(
    path.join(zooidDir, WORKFORCE_FILENAME),
    JSON.stringify(output, null, 2) + '\n',
  );
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
