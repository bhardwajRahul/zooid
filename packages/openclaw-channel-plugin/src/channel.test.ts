import { describe, expect, it, vi } from 'vitest';
import { zooidPlugin } from './channel.js';
import type { OpenClawConfig } from 'openclaw/plugin-sdk';

function createCfg(
  overrides?: Partial<OpenClawConfig['channels']>,
): OpenClawConfig {
  return {
    channels: {
      zooid: {
        enabled: true,
        serverUrl: 'https://zooid.example.workers.dev',
        token: 'token-default',
        defaultPublishChannel: 'agent-output',
        accounts: {
          staging: {
            serverUrl: 'https://staging.example.workers.dev',
            token: 'token-staging',
          },
        },
      },
      ...overrides,
    },
  };
}

describe('zooidPlugin config', () => {
  it('lists account ids including default', () => {
    const cfg = createCfg();
    const ids = zooidPlugin.config.listAccountIds(cfg);
    expect(ids).toContain('default');
    expect(ids).toContain('staging');
  });

  it('resolves default account from top-level config', () => {
    const cfg = createCfg();
    const account = zooidPlugin.config.resolveAccount(cfg);
    expect(account.accountId).toBe('default');
    expect(account.serverUrl).toBe('https://zooid.example.workers.dev');
    expect(account.token).toBe('token-default');
    expect(account.tokenSource).toBe('config');
    expect(account.defaultPublishChannel).toBe('agent-output');
  });

  it('resolves named account from accounts section', () => {
    const cfg = createCfg();
    const account = zooidPlugin.config.resolveAccount(cfg, 'staging');
    expect(account.accountId).toBe('staging');
    expect(account.serverUrl).toBe('https://staging.example.workers.dev');
    expect(account.token).toBe('token-staging');
  });

  it('marks account as configured when serverUrl and token are present', () => {
    const cfg = createCfg();
    const account = zooidPlugin.config.resolveAccount(cfg);
    expect(zooidPlugin.config.isConfigured(account)).toBe(true);
  });

  it('marks account as not configured when serverUrl is missing', () => {
    const cfg = createCfg();
    cfg.channels!.zooid!.serverUrl = '';
    const account = zooidPlugin.config.resolveAccount(cfg);
    expect(zooidPlugin.config.isConfigured(account)).toBe(false);
    expect(zooidPlugin.config.unconfiguredReason(account)).toBe(
      'serverUrl not configured',
    );
  });

  it('marks account as not configured when token is missing', () => {
    const saved = process.env.ZOOID_TOKEN;
    delete process.env.ZOOID_TOKEN;
    try {
      const cfg = createCfg();
      cfg.channels!.zooid!.token = '';
      const account = zooidPlugin.config.resolveAccount(cfg);
      expect(zooidPlugin.config.isConfigured(account)).toBe(false);
      expect(zooidPlugin.config.unconfiguredReason(account)).toBe(
        'token not configured',
      );
    } finally {
      if (saved !== undefined) process.env.ZOOID_TOKEN = saved;
    }
  });

  it('resolves defaultTo from defaultPublishChannel', () => {
    const cfg = createCfg();
    const defaultTo = zooidPlugin.config.resolveDefaultTo({ cfg });
    expect(defaultTo).toBe('agent-output');
  });

  it('returns empty list when zooid section is absent', () => {
    expect(zooidPlugin.config.listAccountIds({})).toEqual([]);
  });
});

describe('zooidPlugin pairing', () => {
  it('strips zooid: prefix from allow entries', () => {
    expect(zooidPlugin.pairing.normalizeAllowEntry('zooid:auth0:user123')).toBe(
      'auth0:user123',
    );
  });

  it('preserves entries without prefix', () => {
    expect(zooidPlugin.pairing.normalizeAllowEntry('auth0:user123')).toBe(
      'auth0:user123',
    );
  });
});

describe('zooidPlugin messaging', () => {
  it('validates well-formed channel ids', () => {
    expect(
      zooidPlugin.messaging.targetResolver.looksLikeId('agent-signals'),
    ).toBe(true);
    expect(
      zooidPlugin.messaging.targetResolver.looksLikeId('my-channel-123'),
    ).toBe(true);
  });

  it('rejects invalid channel ids', () => {
    expect(zooidPlugin.messaging.targetResolver.looksLikeId('AB')).toBe(false);
    expect(zooidPlugin.messaging.targetResolver.looksLikeId('has spaces')).toBe(
      false,
    );
    expect(
      zooidPlugin.messaging.targetResolver.looksLikeId('-leading-hyphen'),
    ).toBe(false);
  });

  it('normalizes target to lowercase', () => {
    expect(zooidPlugin.messaging.normalizeTarget('  My-Channel  ')).toBe(
      'my-channel',
    );
  });
});

describe('zooidPlugin outbound', () => {
  it('publishes text as a message event', async () => {
    const mockPublish = vi.fn(async () => ({
      id: 'evt-1',
      channel_id: 'agent-output',
      publisher_id: null,
      publisher_name: null,
      type: 'message',
      reply_to: null,
      data: '{"body":"hello"}',
      created_at: new Date().toISOString(),
    }));

    // Monkey-patch createClientForAccount via module mock
    const { ZooidClient } = await import('@zooid/sdk');
    vi.spyOn(ZooidClient.prototype, 'publish').mockImplementation(mockPublish);

    const cfg = createCfg();
    const result = await zooidPlugin.outbound.sendText({
      cfg,
      to: 'agent-output',
      text: 'hello',
    });

    expect(mockPublish).toHaveBeenCalledWith('agent-output', {
      type: 'message',
      data: { body: 'hello' },
    });
    expect(result).toMatchObject({ channel: 'zooid', messageId: 'evt-1' });

    vi.restoreAllMocks();
  });

  it('publishes payload with zooid channel data merged', async () => {
    const mockPublish = vi.fn(async () => ({
      id: 'evt-2',
      channel_id: 'agent-output',
      publisher_id: null,
      publisher_name: null,
      type: 'message',
      reply_to: null,
      data: '{"body":"status update","priority":"high"}',
      created_at: new Date().toISOString(),
    }));

    const { ZooidClient } = await import('@zooid/sdk');
    vi.spyOn(ZooidClient.prototype, 'publish').mockImplementation(mockPublish);

    const cfg = createCfg();
    const result = await zooidPlugin.outbound.sendPayload({
      cfg,
      to: 'agent-output',
      text: '',
      payload: {
        text: 'status update',
        channelData: { zooid: { priority: 'high' } },
      },
    });

    expect(mockPublish).toHaveBeenCalledWith('agent-output', {
      type: 'message',
      data: { body: 'status update', priority: 'high' },
    });
    expect(result).toMatchObject({ channel: 'zooid', messageId: 'evt-2' });

    vi.restoreAllMocks();
  });
});

describe('zooidPlugin setup', () => {
  it('validates that serverUrl is required', () => {
    const err = zooidPlugin.setup.validateInput({
      accountId: 'default',
      input: { token: 'tok' },
    });
    expect(err).toContain('serverUrl');
  });

  it('validates that token is required without useEnv', () => {
    const err = zooidPlugin.setup.validateInput({
      accountId: 'default',
      input: { serverUrl: 'https://example.com' },
    });
    expect(err).toContain('token');
  });

  it('allows useEnv for default account', () => {
    const err = zooidPlugin.setup.validateInput({
      accountId: 'default',
      input: { serverUrl: 'https://example.com', useEnv: true },
    });
    expect(err).toBeNull();
  });

  it('rejects useEnv for non-default account', () => {
    const err = zooidPlugin.setup.validateInput({
      accountId: 'staging',
      input: { serverUrl: 'https://example.com', useEnv: true },
    });
    expect(err).toContain('ZOOID_TOKEN');
  });

  it('applies config for default account', () => {
    const cfg: OpenClawConfig = {};
    const result = zooidPlugin.setup.applyAccountConfig({
      cfg,
      accountId: 'default',
      input: {
        serverUrl: 'https://zooid.example.workers.dev',
        token: 'my-token',
        defaultPublishChannel: 'output',
      },
    });
    expect(result.channels?.zooid).toMatchObject({
      enabled: true,
      serverUrl: 'https://zooid.example.workers.dev',
      token: 'my-token',
      defaultPublishChannel: 'output',
    });
  });

  it('applies config for named account', () => {
    const cfg: OpenClawConfig = {};
    const result = zooidPlugin.setup.applyAccountConfig({
      cfg,
      accountId: 'staging',
      input: {
        serverUrl: 'https://staging.example.workers.dev',
        token: 'staging-token',
      },
    });
    expect(result.channels?.zooid?.accounts?.staging).toMatchObject({
      enabled: true,
      serverUrl: 'https://staging.example.workers.dev',
      token: 'staging-token',
    });
  });
});

describe('zooidPlugin status', () => {
  it('builds snapshot with probe data', () => {
    const cfg = createCfg();
    const account = zooidPlugin.config.resolveAccount(cfg);
    const snapshot = zooidPlugin.status.buildAccountSnapshot({
      account,
      cfg,
      probe: {
        ok: true,
        serverUrl: account.serverUrl,
        claims: { scopes: ['pub:agent-output', 'sub:commands'], iat: 0 },
        channels: [],
        elapsedMs: 42,
      },
    });

    expect(snapshot.configured).toBe(true);
    expect(snapshot.probe).toMatchObject({
      ok: true,
      scopes: ['pub:agent-output', 'sub:commands'],
    });
  });
});
