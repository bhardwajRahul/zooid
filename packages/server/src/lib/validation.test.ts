import { describe, it, expect } from 'vitest';
import { isValidChannelId, isAllowedWebhookUrl } from './validation';

describe('Channel ID validation', () => {
  it('accepts valid slugs', () => {
    expect(isValidChannelId('polymarket-signals')).toBe(true);
    expect(isValidChannelId('abc')).toBe(true);
    expect(isValidChannelId('my-channel-123')).toBe(true);
  });

  it('rejects too short (< 3 chars)', () => {
    expect(isValidChannelId('ab')).toBe(false);
    expect(isValidChannelId('a')).toBe(false);
    expect(isValidChannelId('')).toBe(false);
  });

  it('rejects too long (> 64 chars)', () => {
    expect(isValidChannelId('a'.repeat(65))).toBe(false);
  });

  it('rejects uppercase', () => {
    expect(isValidChannelId('MyChannel')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidChannelId('my_channel')).toBe(false);
    expect(isValidChannelId('my.channel')).toBe(false);
    expect(isValidChannelId('my channel')).toBe(false);
  });

  it('rejects leading/trailing hyphens', () => {
    expect(isValidChannelId('-my-channel')).toBe(false);
    expect(isValidChannelId('my-channel-')).toBe(false);
  });
});

describe('Webhook URL validation', () => {
  it('allows public HTTPS URLs', () => {
    expect(isAllowedWebhookUrl('https://example.com/webhook')).toBe(true);
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/T00/B00/xxx')).toBe(true);
    expect(isAllowedWebhookUrl('http://example.com/webhook')).toBe(true);
  });

  it('blocks loopback addresses', () => {
    expect(isAllowedWebhookUrl('http://localhost/hook')).toBe(false);
    expect(isAllowedWebhookUrl('http://127.0.0.1/hook')).toBe(false);
    expect(isAllowedWebhookUrl('http://[::1]/hook')).toBe(false);
    expect(isAllowedWebhookUrl('http://0.0.0.0/hook')).toBe(false);
  });

  it('blocks private IP ranges', () => {
    expect(isAllowedWebhookUrl('http://10.0.0.1/hook')).toBe(false);
    expect(isAllowedWebhookUrl('http://172.16.0.1/hook')).toBe(false);
    expect(isAllowedWebhookUrl('http://172.31.255.255/hook')).toBe(false);
    expect(isAllowedWebhookUrl('http://192.168.1.1/hook')).toBe(false);
  });

  it('allows non-private 172.x addresses', () => {
    expect(isAllowedWebhookUrl('http://172.15.0.1/hook')).toBe(true);
    expect(isAllowedWebhookUrl('http://172.32.0.1/hook')).toBe(true);
  });

  it('blocks cloud metadata endpoints', () => {
    expect(isAllowedWebhookUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedWebhookUrl('http://metadata.google.internal/computeMetadata')).toBe(false);
  });

  it('blocks link-local addresses', () => {
    expect(isAllowedWebhookUrl('http://169.254.0.1/hook')).toBe(false);
  });

  it('blocks non-HTTP schemes', () => {
    expect(isAllowedWebhookUrl('ftp://example.com/hook')).toBe(false);
    expect(isAllowedWebhookUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedWebhookUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedWebhookUrl('not-a-url')).toBe(false);
    expect(isAllowedWebhookUrl('')).toBe(false);
  });
});
