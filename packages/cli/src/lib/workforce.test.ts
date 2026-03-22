import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadWorkforce,
  saveWorkforce,
  compileAgents,
  validateWorkforceFile,
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

describe('validateWorkforceFile', () => {
  it('accepts a valid workforce file', () => {
    expect(() =>
      validateWorkforceFile(
        {
          channels: { general: { visibility: 'private' } },
          roles: { member: { scopes: ['sub:general'] } },
        },
        'test.json',
      ),
    ).not.toThrow();
  });

  it('accepts a file with $schema and meta', () => {
    expect(() =>
      validateWorkforceFile(
        {
          $schema: 'https://zooid.dev/schemas/workforce.json',
          meta: {
            name: 'Chat',
            slug: 'chat',
            description: 'Simple chat',
            tags: ['chat'],
          },
          channels: { general: { visibility: 'private' } },
          roles: {},
        },
        'test.json',
      ),
    ).not.toThrow();
  });

  it('rejects channel without visibility', () => {
    expect(() =>
      validateWorkforceFile(
        {
          channels: { general: { name: 'General' } },
        },
        'test.json',
      ),
    ).toThrow(/visibility/);
  });

  it('rejects role without scopes', () => {
    expect(() =>
      validateWorkforceFile(
        {
          roles: { member: { name: 'Member' } },
        },
        'test.json',
      ),
    ).toThrow(/scopes/);
  });

  it('rejects invalid channel ID slug', () => {
    expect(() =>
      validateWorkforceFile(
        {
          channels: { 'INVALID SLUG!': { visibility: 'public' } },
        },
        'test.json',
      ),
    ).toThrow(/slug/i);
  });

  it('rejects invalid role ID slug', () => {
    expect(() =>
      validateWorkforceFile(
        {
          roles: { AB: { scopes: ['admin'] } },
        },
        'test.json',
      ),
    ).toThrow(/slug/i);
  });

  it('rejects invalid meta.slug', () => {
    expect(() =>
      validateWorkforceFile(
        {
          meta: { slug: 'INVALID SLUG!!' },
          channels: {},
        },
        'test.json',
      ),
    ).toThrow(/slug/i);
  });

  it('rejects absolute include paths', () => {
    expect(() =>
      validateWorkforceFile(
        {
          include: ['/etc/workforce.json'],
        },
        'test.json',
      ),
    ).toThrow();
  });

  it('rejects include paths that escape .zooid/ (tested via loadWorkforce)', () => {
    // ../outside.json from root workforce.json escapes .zooid/
    // This is caught at resolve time, not validation time,
    // because ../foo.json can be valid from subdirectories.
    // See the 'loadWorkforce with include' tests for this check.
    const dir = path.join(tmpDir, '.zooid');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'workforce.json'),
      JSON.stringify({ include: ['../outside.json'] }, null, 2),
    );

    expect(() => loadWorkforce()).toThrow(/escapes|not found/);
  });

  it('accepts valid include paths', () => {
    expect(() =>
      validateWorkforceFile(
        {
          include: ['./chat/workforce.json', './pipelines/ingest.json'],
        },
        'test.json',
      ),
    ).not.toThrow();
  });

  it('accepts empty file (all optional)', () => {
    expect(() => validateWorkforceFile({}, 'test.json')).not.toThrow();
  });
});

describe('loadWorkforce with include', () => {
  function writeFile(relativePath: string, data: Record<string, unknown>) {
    const filePath = path.join(tmpDir, '.zooid', relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  it('merges channels and roles from included files', () => {
    writeFile('chat/workforce.json', {
      channels: { general: { visibility: 'private' } },
      roles: { member: { scopes: ['pub:general', 'sub:general'] } },
    });
    writeFile('workforce.json', {
      include: ['./chat/workforce.json'],
      channels: { announcements: { visibility: 'public' } },
      roles: { admin: { scopes: ['admin'] } },
    });

    const wf = loadWorkforce();
    expect(Object.keys(wf.channels)).toEqual(
      expect.arrayContaining(['general', 'announcements']),
    );
    expect(Object.keys(wf.roles)).toEqual(
      expect.arrayContaining(['member', 'admin']),
    );
  });

  it('root file wins over included file on key collision', () => {
    writeFile('base/workforce.json', {
      channels: { alerts: { visibility: 'public', name: 'Base Alerts' } },
    });
    writeFile('workforce.json', {
      include: ['./base/workforce.json'],
      channels: { alerts: { visibility: 'private', name: 'My Alerts' } },
    });

    const wf = loadWorkforce();
    expect(wf.channels.alerts.visibility).toBe('private');
    expect(wf.channels.alerts.name).toBe('My Alerts');
  });

  it('later included files win over earlier ones', () => {
    writeFile('a.json', {
      roles: { reader: { scopes: ['sub:alpha'] } },
    });
    writeFile('b.json', {
      roles: { reader: { scopes: ['sub:beta'] } },
    });
    writeFile('workforce.json', {
      include: ['./a.json', './b.json'],
    });

    const wf = loadWorkforce();
    expect(wf.roles.reader.scopes).toEqual(['sub:beta']);
  });

  it('resolves recursive includes (depth-first)', () => {
    writeFile('base-messaging.json', {
      channels: { foundation: { visibility: 'public' } },
    });
    writeFile('chat/workforce.json', {
      include: ['../base-messaging.json'],
      channels: { general: { visibility: 'private' } },
    });
    writeFile('workforce.json', {
      include: ['./chat/workforce.json'],
      channels: { announcements: { visibility: 'public' } },
    });

    const wf = loadWorkforce();
    expect(Object.keys(wf.channels)).toEqual(
      expect.arrayContaining(['foundation', 'general', 'announcements']),
    );
  });

  it('throws on circular includes', () => {
    writeFile('a.json', {
      include: ['./b.json'],
      channels: { alpha: { visibility: 'public' } },
    });
    writeFile('b.json', {
      include: ['./a.json'],
      channels: { beta: { visibility: 'public' } },
    });
    writeFile('workforce.json', {
      include: ['./a.json'],
    });

    expect(() => loadWorkforce()).toThrow(/[Cc]ircular include/);
  });

  it('compiles agents after merge — cross-file channel references work', () => {
    writeFile('chat/workforce.json', {
      channels: { general: { visibility: 'private' } },
    });
    writeFile('bots.json', {
      agents: {
        greeter: { publishes: ['general'], subscribes: ['general'] },
      },
    });
    writeFile('workforce.json', {
      include: ['./chat/workforce.json', './bots.json'],
    });

    const wf = loadWorkforce();
    expect(wf.roles.greeter).toBeDefined();
    expect(wf.roles.greeter.scopes).toEqual(
      expect.arrayContaining(['pub:general', 'sub:general']),
    );
  });

  it('agent-role name collision across files is a validation error', () => {
    writeFile('agents.json', {
      agents: { writer: { publishes: ['data'] } },
    });
    writeFile('workforce.json', {
      include: ['./agents.json'],
      channels: { data: { visibility: 'public' } },
      roles: { writer: { scopes: ['admin'] } },
    });

    expect(() => loadWorkforce()).toThrow(/collides/);
  });

  it('handles included files in subdirectories', () => {
    writeFile('pipelines/ingest.json', {
      channels: { raw: { visibility: 'private' } },
    });
    writeFile('workforce.json', {
      include: ['./pipelines/ingest.json'],
    });

    const wf = loadWorkforce();
    expect(wf.channels.raw).toBeDefined();
  });

  it('errors when included file does not exist', () => {
    writeFile('workforce.json', {
      include: ['./missing.json'],
    });

    expect(() => loadWorkforce()).toThrow();
  });

  it('works with empty include array', () => {
    writeFile('workforce.json', {
      include: [],
      channels: { test: { visibility: 'public' } },
    });

    const wf = loadWorkforce();
    expect(wf.channels.test).toBeDefined();
  });

  it('ignores meta and $schema during merge', () => {
    writeFile('chat/workforce.json', {
      $schema: 'https://zooid.dev/schemas/workforce.json',
      meta: { name: 'Chat', slug: 'chat' },
      channels: { general: { visibility: 'private' } },
    });
    writeFile('workforce.json', {
      $schema: 'https://zooid.dev/schemas/workforce.json',
      meta: { name: 'My Project', slug: 'my-project' },
      include: ['./chat/workforce.json'],
      channels: { announcements: { visibility: 'public' } },
    });

    const wf = loadWorkforce();
    // meta and $schema don't appear in resolved result
    expect(Object.keys(wf.channels)).toEqual(
      expect.arrayContaining(['general', 'announcements']),
    );
    expect((wf as any).$schema).toBeUndefined();
    expect((wf as any).meta).toBeUndefined();
  });
});

describe('loadWorkforce provenance', () => {
  function writeFile(relativePath: string, data: Record<string, unknown>) {
    const filePath = path.join(tmpDir, '.zooid', relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  it('returns provenance map for channels and roles', () => {
    writeFile('chat/workforce.json', {
      channels: { general: { visibility: 'private' } },
      roles: { member: { scopes: ['sub:general'] } },
    });
    writeFile('workforce.json', {
      include: ['./chat/workforce.json'],
      channels: { announcements: { visibility: 'public' } },
      roles: { admin: { scopes: ['admin'] } },
    });

    const wf = loadWorkforce();
    const zooidDir = path.join(tmpDir, '.zooid');
    expect(wf.provenance.channels.general).toBe(
      path.join(zooidDir, 'chat', 'workforce.json'),
    );
    expect(wf.provenance.channels.announcements).toBe(
      path.join(zooidDir, 'workforce.json'),
    );
    expect(wf.provenance.roles.member).toBe(
      path.join(zooidDir, 'chat', 'workforce.json'),
    );
    expect(wf.provenance.roles.admin).toBe(
      path.join(zooidDir, 'workforce.json'),
    );
  });

  it('provenance reflects last-wins — points to the winning file', () => {
    writeFile('a.json', {
      roles: { reader: { scopes: ['sub:alpha'] } },
    });
    writeFile('b.json', {
      roles: { reader: { scopes: ['sub:beta'] } },
    });
    writeFile('workforce.json', {
      include: ['./a.json', './b.json'],
    });

    const wf = loadWorkforce();
    expect(wf.provenance.roles.reader).toBe(
      path.join(tmpDir, '.zooid', 'b.json'),
    );
  });

  it('provenance for compiled agents points to the file that defined the agent', () => {
    writeFile('bots.json', {
      agents: {
        greeter: { publishes: ['general'], subscribes: ['general'] },
      },
    });
    writeFile('workforce.json', {
      include: ['./bots.json'],
      channels: { general: { visibility: 'private' } },
    });

    const wf = loadWorkforce();
    // greeter was compiled from an agent in bots.json, not root
    expect(wf.provenance.roles.greeter).toBe(
      path.join(tmpDir, '.zooid', 'bots.json'),
    );
  });

  it('provenance without include returns root file for all entries', () => {
    writeFile('workforce.json', {
      channels: { test: { visibility: 'public' } },
      roles: { admin: { scopes: ['admin'] } },
    });

    const wf = loadWorkforce();
    const rootPath = path.join(tmpDir, '.zooid', 'workforce.json');
    expect(wf.provenance.channels.test).toBe(rootPath);
    expect(wf.provenance.roles.admin).toBe(rootPath);
  });
});

describe('saveWorkforce to specific file', () => {
  function writeFile(relativePath: string, data: object) {
    const filePath = path.join(tmpDir, '.zooid', relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  it('updates a specific channel in an included file', () => {
    writeFile('chat/workforce.json', {
      channels: { general: { visibility: 'private', name: 'General' } },
      roles: { member: { scopes: ['sub:general'] } },
    });
    writeFile('workforce.json', {
      include: ['./chat/workforce.json'],
      channels: {},
      roles: {},
    });

    const chatPath = path.join(tmpDir, '.zooid', 'chat', 'workforce.json');
    saveWorkforce(
      {
        channels: {
          general: { visibility: 'private', name: 'Updated General' },
        },
        roles: { member: { scopes: ['sub:general'] } },
      },
      { targetFile: chatPath },
    );

    const raw = JSON.parse(fs.readFileSync(chatPath, 'utf-8'));
    expect(raw.channels.general.name).toBe('Updated General');
  });

  it('preserves $schema and meta when writing', () => {
    writeFile('chat/workforce.json', {
      $schema: 'https://zooid.dev/schemas/workforce.json',
      meta: { name: 'Chat', slug: 'chat' },
      channels: { general: { visibility: 'private' } },
      roles: {},
    });

    const chatPath = path.join(tmpDir, '.zooid', 'chat', 'workforce.json');
    saveWorkforce(
      {
        channels: { general: { visibility: 'public' } },
        roles: {},
      },
      { targetFile: chatPath },
    );

    const raw = JSON.parse(fs.readFileSync(chatPath, 'utf-8'));
    expect(raw.$schema).toBe('https://zooid.dev/schemas/workforce.json');
    expect(raw.meta.slug).toBe('chat');
    expect(raw.channels.general.visibility).toBe('public');
  });

  it('preserves include array when writing root workforce.json', () => {
    writeFile('chat/workforce.json', {
      channels: { general: { visibility: 'private' } },
    });
    writeFile('workforce.json', {
      include: ['./chat/workforce.json'],
      channels: { announcements: { visibility: 'public' } },
      roles: {},
    });

    const rootPath = path.join(tmpDir, '.zooid', 'workforce.json');
    saveWorkforce(
      {
        channels: {
          announcements: { visibility: 'public' },
          news: { visibility: 'public' },
        },
        roles: {},
      },
      { targetFile: rootPath },
    );

    const raw = JSON.parse(fs.readFileSync(rootPath, 'utf-8'));
    expect(raw.include).toEqual(['./chat/workforce.json']);
    expect(raw.channels.news).toBeDefined();
  });

  it('preserves agents in target file when writing', () => {
    writeFile('bots.json', {
      agents: { greeter: { publishes: ['general'] } },
    });

    const botsPath = path.join(tmpDir, '.zooid', 'bots.json');
    saveWorkforce(
      {
        channels: {},
        roles: {},
      },
      { targetFile: botsPath },
    );

    const raw = JSON.parse(fs.readFileSync(botsPath, 'utf-8'));
    expect(raw.agents.greeter).toBeDefined();
  });
});
