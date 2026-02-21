import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runHistory } from './history';
import type { ZooidConfigFile } from '../lib/config';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-test-'));
  vi.stubEnv('ZOOID_CONFIG_DIR', tmpDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runHistory()', () => {
  it('returns empty array when no config exists', () => {
    expect(runHistory()).toEqual([]);
  });

  it('returns entries sorted by last_tailed_at descending', () => {
    const file: ZooidConfigFile = {
      current: 'https://a.com',
      servers: {
        'https://a.com': {
          channels: {
            old: {
              stats: {
                num_tails: 5,
                first_tailed_at: '2025-01-01T00:00:00Z',
                last_tailed_at: '2025-06-01T00:00:00Z',
              },
            },
            recent: {
              stats: {
                num_tails: 2,
                first_tailed_at: '2025-12-01T00:00:00Z',
                last_tailed_at: '2025-12-15T00:00:00Z',
              },
            },
          },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));

    const entries = runHistory();
    expect(entries).toHaveLength(2);
    expect(entries[0].channel_id).toBe('recent');
    expect(entries[1].channel_id).toBe('old');
  });

  it('skips channels without stats', () => {
    const file: ZooidConfigFile = {
      current: 'https://a.com',
      servers: {
        'https://a.com': {
          channels: {
            'with-stats': {
              stats: {
                num_tails: 1,
                first_tailed_at: '2025-01-01T00:00:00Z',
                last_tailed_at: '2025-01-01T00:00:00Z',
              },
            },
            'tokens-only': { publish_token: 'pt' },
          },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));

    const entries = runHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].channel_id).toBe('with-stats');
  });

  it('aggregates across multiple servers', () => {
    const file: ZooidConfigFile = {
      current: 'https://a.com',
      servers: {
        'https://a.com': {
          channels: {
            ch1: {
              stats: {
                num_tails: 3,
                first_tailed_at: '2025-01-01T00:00:00Z',
                last_tailed_at: '2025-06-01T00:00:00Z',
              },
            },
          },
        },
        'https://b.com': {
          channels: {
            ch2: {
              stats: {
                num_tails: 1,
                first_tailed_at: '2025-12-01T00:00:00Z',
                last_tailed_at: '2025-12-01T00:00:00Z',
              },
            },
          },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));

    const entries = runHistory();
    expect(entries).toHaveLength(2);
    expect(entries[0].server).toBe('https://b.com');
    expect(entries[1].server).toBe('https://a.com');
  });

  it('includes channel name when stored', () => {
    const file: ZooidConfigFile = {
      current: 'https://a.com',
      servers: {
        'https://a.com': {
          channels: {
            ch1: {
              name: 'My Channel',
              stats: {
                num_tails: 1,
                first_tailed_at: '2025-01-01T00:00:00Z',
                last_tailed_at: '2025-01-01T00:00:00Z',
              },
            },
          },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(file));

    const entries = runHistory();
    expect(entries[0].name).toBe('My Channel');
  });
});
