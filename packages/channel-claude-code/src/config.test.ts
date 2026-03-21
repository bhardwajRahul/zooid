import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const REQUIRED_ENV = {
    ZOOID_SERVER: 'https://my-server.workers.dev',
    ZOOID_TOKEN: 'eyJ.test.token',
    ZOOID_CHANNEL: 'tasks',
  };

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...REQUIRED_ENV },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses token auth from ZOOID_TOKEN', () => {
    const config = loadConfig();
    expect(config).toEqual({
      server: 'https://my-server.workers.dev',
      auth: { mode: 'token', token: 'eyJ.test.token' },
      channel: 'tasks',
      transport: 'auto',
      pollInterval: 5000,
    });
  });

  it('parses client credentials auth from ZOOID_CLIENT_ID + ZOOID_CLIENT_SECRET', () => {
    delete process.env.ZOOID_TOKEN;
    process.env.ZOOID_CLIENT_ID = 'my-client-id';
    process.env.ZOOID_CLIENT_SECRET = 'my-client-secret';
    const config = loadConfig();
    expect(config.auth).toEqual({
      mode: 'client_credentials',
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
    });
  });

  it('passes optional ZOOID_TOKEN_ENDPOINT for self-hosted servers', () => {
    delete process.env.ZOOID_TOKEN;
    process.env.ZOOID_CLIENT_ID = 'my-client-id';
    process.env.ZOOID_CLIENT_SECRET = 'my-client-secret';
    process.env.ZOOID_TOKEN_ENDPOINT =
      'https://my-auth.example.com/oauth2/token';
    const config = loadConfig();
    expect(config.auth).toEqual({
      mode: 'client_credentials',
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      tokenEndpoint: 'https://my-auth.example.com/oauth2/token',
    });
  });

  it('prefers ZOOID_TOKEN over client credentials when both are set', () => {
    process.env.ZOOID_CLIENT_ID = 'my-client-id';
    process.env.ZOOID_CLIENT_SECRET = 'my-client-secret';
    const config = loadConfig();
    expect(config.auth).toEqual({
      mode: 'token',
      token: 'eyJ.test.token',
    });
  });

  it('throws when neither token nor client credentials are set', () => {
    delete process.env.ZOOID_TOKEN;
    expect(() => loadConfig()).toThrow(/ZOOID_TOKEN.*ZOOID_CLIENT_ID/);
  });

  it('throws when ZOOID_CLIENT_ID is set without ZOOID_CLIENT_SECRET', () => {
    delete process.env.ZOOID_TOKEN;
    process.env.ZOOID_CLIENT_ID = 'my-client-id';
    expect(() => loadConfig()).toThrow('ZOOID_CLIENT_SECRET');
  });

  it('parses optional ZOOID_TRANSPORT', () => {
    process.env.ZOOID_TRANSPORT = 'ws';
    const config = loadConfig();
    expect(config.transport).toBe('ws');
  });

  it('parses optional ZOOID_POLL_INTERVAL', () => {
    process.env.ZOOID_POLL_INTERVAL = '10000';
    const config = loadConfig();
    expect(config.pollInterval).toBe(10000);
  });

  it('throws on missing ZOOID_SERVER', () => {
    delete process.env.ZOOID_SERVER;
    expect(() => loadConfig()).toThrow('ZOOID_SERVER');
  });

  it('throws on missing ZOOID_CHANNEL', () => {
    delete process.env.ZOOID_CHANNEL;
    expect(() => loadConfig()).toThrow('ZOOID_CHANNEL');
  });

  it('throws on invalid ZOOID_TRANSPORT value', () => {
    process.env.ZOOID_TRANSPORT = 'invalid';
    expect(() => loadConfig()).toThrow('ZOOID_TRANSPORT');
  });

  it('defaults transport to auto', () => {
    const config = loadConfig();
    expect(config.transport).toBe('auto');
  });

  it('defaults pollInterval to 5000', () => {
    const config = loadConfig();
    expect(config.pollInterval).toBe(5000);
  });
});
