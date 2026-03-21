import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadWorkforce,
  saveWorkforce,
  compileAgents,
  type WorkforceFile,
} from './workforce';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-workforce-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeWorkforce(data: WorkforceFile) {
  const dir = path.join(tmpDir, '.zooid');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'workforce.json'),
    JSON.stringify(data, null, 2),
  );
}

describe('loadWorkforce', () => {
  it('returns empty channels and roles when no workforce.json exists', () => {
    const wf = loadWorkforce();
    expect(wf.channels).toEqual({});
    expect(wf.roles).toEqual({});
  });

  it('loads channels and roles from workforce.json', () => {
    writeWorkforce({
      channels: {
        signals: { visibility: 'private', name: 'Signals' },
        'market-data': { visibility: 'public' },
      },
      roles: {
        analyst: { scopes: ['sub:market-data', 'pub:signals'] },
      },
    });

    const wf = loadWorkforce();
    expect(Object.keys(wf.channels)).toEqual(['signals', 'market-data']);
    expect(wf.channels.signals.name).toBe('Signals');
    expect(wf.roles.analyst.scopes).toEqual(['sub:market-data', 'pub:signals']);
  });

  it('returns empty when .zooid/ does not exist', () => {
    const wf = loadWorkforce();
    expect(wf.channels).toEqual({});
    expect(wf.roles).toEqual({});
  });

  it('handles workforce.json with only channels', () => {
    writeWorkforce({
      channels: { test: { visibility: 'public' } },
    } as WorkforceFile);

    const wf = loadWorkforce();
    expect(Object.keys(wf.channels)).toEqual(['test']);
    expect(wf.roles).toEqual({});
  });

  it('handles workforce.json with only roles', () => {
    writeWorkforce({
      roles: { admin: { scopes: ['admin'] } },
    } as WorkforceFile);

    const wf = loadWorkforce();
    expect(wf.channels).toEqual({});
    expect(wf.roles.admin.scopes).toEqual(['admin']);
  });

  it('finds workforce.json from a subdirectory', () => {
    writeWorkforce({
      channels: { test: { visibility: 'public' } },
      roles: {},
    });
    const sub = path.join(tmpDir, 'src', 'lib');
    fs.mkdirSync(sub, { recursive: true });
    process.chdir(sub);

    const wf = loadWorkforce();
    expect(Object.keys(wf.channels)).toEqual(['test']);
  });

  it('compiles agents into roles when agents key is present', () => {
    writeWorkforce({
      channels: {
        research: { visibility: 'private' },
        drafts: { visibility: 'private' },
      },
      agents: {
        researcher: {
          description: 'Gathers sources',
          publishes: ['research'],
        },
        writer: {
          publishes: ['drafts'],
          subscribes: ['research'],
        },
      },
    } as WorkforceFile);

    const wf = loadWorkforce();
    expect(wf.roles.researcher).toEqual({
      description: 'Gathers sources',
      scopes: ['pub:research'],
    });
    expect(wf.roles.writer).toEqual({
      scopes: ['sub:research', 'pub:drafts'],
    });
  });

  it('merges agents and roles when both present', () => {
    writeWorkforce({
      channels: {
        data: { visibility: 'public' },
      },
      agents: {
        writer: { publishes: ['data'] },
      },
      roles: {
        admin: { scopes: ['admin'] },
      },
    } as WorkforceFile);

    const wf = loadWorkforce();
    expect(wf.roles.writer.scopes).toEqual(['pub:data']);
    expect(wf.roles.admin.scopes).toEqual(['admin']);
  });

  it('throws when agent name collides with role name', () => {
    writeWorkforce({
      channels: { data: { visibility: 'public' } },
      agents: {
        analyst: { publishes: ['data'] },
      },
      roles: {
        analyst: { scopes: ['admin'] },
      },
    } as WorkforceFile);

    expect(() => loadWorkforce()).toThrow(
      'agent "analyst" collides with a role of the same name',
    );
  });
});

describe('saveWorkforce', () => {
  it('writes workforce.json to .zooid/', () => {
    fs.mkdirSync(path.join(tmpDir, '.zooid'), { recursive: true });

    saveWorkforce({
      channels: { test: { visibility: 'public' } },
      roles: { reader: { scopes: ['sub:test'] } },
    });

    const filePath = path.join(tmpDir, '.zooid', 'workforce.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.channels.test.visibility).toBe('public');
    expect(content.roles.reader.scopes).toEqual(['sub:test']);
  });

  it('creates .zooid/ directory if missing', () => {
    saveWorkforce({
      channels: {},
      roles: {},
    });

    expect(fs.existsSync(path.join(tmpDir, '.zooid', 'workforce.json'))).toBe(
      true,
    );
  });

  it('overwrites existing workforce.json', () => {
    writeWorkforce({ channels: { old: { visibility: 'public' } }, roles: {} });

    saveWorkforce({
      channels: { new: { visibility: 'private' } },
      roles: {},
    });

    const content = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
    );
    expect(content.channels.new).toBeDefined();
    expect(content.channels.old).toBeUndefined();
  });

  it('does not write agents key — only channels and roles', () => {
    saveWorkforce({
      channels: { test: { visibility: 'public' } },
      roles: { reader: { scopes: ['sub:test'] } },
    });

    const raw = fs.readFileSync(
      path.join(tmpDir, '.zooid', 'workforce.json'),
      'utf-8',
    );
    expect(raw).not.toContain('"agents"');
  });
});

describe('compileAgents', () => {
  it('converts publishes to pub: scopes', () => {
    const roles = compileAgents({
      writer: { publishes: ['drafts', 'signals'] },
    });
    expect(roles.writer.scopes).toEqual(['pub:drafts', 'pub:signals']);
  });

  it('converts subscribes to sub: scopes', () => {
    const roles = compileAgents({
      reader: { subscribes: ['data', 'alerts'] },
    });
    expect(roles.reader.scopes).toEqual(['sub:data', 'sub:alerts']);
  });

  it('combines publishes and subscribes', () => {
    const roles = compileAgents({
      analyst: { publishes: ['signals'], subscribes: ['market-data'] },
    });
    expect(roles.analyst.scopes).toEqual(['sub:market-data', 'pub:signals']);
  });

  it('handles wildcard subscribes', () => {
    const roles = compileAgents({
      reviewer: { subscribes: ['*'] },
    });
    expect(roles.reviewer.scopes).toEqual(['sub:*']);
  });

  it('preserves name and description', () => {
    const roles = compileAgents({
      analyst: {
        name: 'Analyst',
        description: 'Reads data',
        publishes: ['signals'],
      },
    });
    expect(roles.analyst.name).toBe('Analyst');
    expect(roles.analyst.description).toBe('Reads data');
  });

  it('handles agent with no publishes or subscribes', () => {
    const roles = compileAgents({
      observer: { description: 'Just watches' },
    });
    expect(roles.observer.scopes).toEqual([]);
  });
});
