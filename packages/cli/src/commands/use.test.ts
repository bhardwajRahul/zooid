import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-use-test-')),
  );
  origCwd = process.cwd();
  process.chdir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'zooid.json'), '{}');
  fs.mkdirSync(path.join(tmpDir, '.zooid'), { recursive: true });
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('deriveTemplateName', () => {
  it('derives name from last path segment', async () => {
    const { deriveTemplateName } = await import('./use');
    expect(
      deriveTemplateName(
        'https://github.com/zooid-ai/templates/tree/master/chat',
      ),
    ).toBe('chat');
  });

  it('derives name from repo name when no subpath', async () => {
    const { deriveTemplateName } = await import('./use');
    expect(deriveTemplateName('https://github.com/zooid-ai/trading-desk')).toBe(
      'trading-desk',
    );
  });
});

describe('resolveTemplateName', () => {
  it('prefers meta.slug from workforce.json over URL', async () => {
    const { resolveTemplateName } = await import('./use');
    expect(
      resolveTemplateName(
        'https://github.com/zooid-ai/templates/tree/master/my-chat',
        { meta: { slug: 'chat' } },
      ),
    ).toBe('chat');
  });

  it('falls back to URL when no meta.slug', async () => {
    const { resolveTemplateName } = await import('./use');
    expect(
      resolveTemplateName(
        'https://github.com/zooid-ai/templates/tree/master/chat',
        {},
      ),
    ).toBe('chat');
  });

  it('rejects invalid meta.slug', async () => {
    const { resolveTemplateName } = await import('./use');
    expect(() =>
      resolveTemplateName(
        'https://github.com/zooid-ai/templates/tree/master/chat',
        { meta: { slug: 'INVALID!!' } },
      ),
    ).toThrow(/slug/i);
  });
});

describe('addToInclude', () => {
  it('creates include array if not present', async () => {
    const { addToInclude } = await import('./use');
    fs.writeFileSync(
      path.join(tmpDir, '.zooid', 'workforce.json'),
      JSON.stringify({ channels: {}, roles: {} }, null, 2),
    );

    addToInclude('./chat/workforce.json');

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
    );
    expect(raw.include).toEqual(['./chat/workforce.json']);
  });

  it('appends to existing include array', async () => {
    const { addToInclude } = await import('./use');
    fs.writeFileSync(
      path.join(tmpDir, '.zooid', 'workforce.json'),
      JSON.stringify(
        {
          include: ['./chat/workforce.json'],
          channels: {},
          roles: {},
        },
        null,
        2,
      ),
    );

    addToInclude('./monitoring/workforce.json');

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
    );
    expect(raw.include).toEqual([
      './chat/workforce.json',
      './monitoring/workforce.json',
    ]);
  });

  it('does not duplicate existing include entry', async () => {
    const { addToInclude } = await import('./use');
    fs.writeFileSync(
      path.join(tmpDir, '.zooid', 'workforce.json'),
      JSON.stringify(
        {
          include: ['./chat/workforce.json'],
          channels: {},
          roles: {},
        },
        null,
        2,
      ),
    );

    addToInclude('./chat/workforce.json');

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
    );
    expect(raw.include).toEqual(['./chat/workforce.json']);
  });

  it('preserves $schema and meta when adding include', async () => {
    const { addToInclude } = await import('./use');
    fs.writeFileSync(
      path.join(tmpDir, '.zooid', 'workforce.json'),
      JSON.stringify(
        {
          $schema: 'https://zooid.dev/schemas/workforce.json',
          meta: { name: 'My Project' },
          channels: {},
          roles: {},
        },
        null,
        2,
      ),
    );

    addToInclude('./chat/workforce.json');

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
    );
    expect(raw.$schema).toBe('https://zooid.dev/schemas/workforce.json');
    expect(raw.meta.name).toBe('My Project');
    expect(raw.include).toEqual(['./chat/workforce.json']);
  });

  it('creates workforce.json with include if it does not exist', async () => {
    const { addToInclude } = await import('./use');

    addToInclude('./chat/workforce.json');

    const raw = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.zooid', 'workforce.json'), 'utf-8'),
    );
    expect(raw.include).toEqual(['./chat/workforce.json']);
    expect(raw.channels).toEqual({});
    expect(raw.roles).toEqual({});
  });
});
