import { describe, it, expect } from 'vitest';
import { normalizeScopes } from './scopes';
import type { ZooidJWT } from './types';

function normalize(overrides: Partial<ZooidJWT> & Record<string, unknown>) {
  return normalizeScopes(overrides as ZooidJWT);
}

describe('normalizeScopes', () => {
  it('returns scopes array directly when present', () => {
    expect(normalize({ scopes: ['pub:test', 'sub:test'] })).toEqual([
      'pub:test',
      'sub:test',
    ]);
  });

  it('returns zooid.dev/scopes claim when present', () => {
    expect(
      normalize({ 'https://zooid.dev/scopes': ['pub:news', 'sub:news'] }),
    ).toEqual(['pub:news', 'sub:news']);
  });

  // CRITICAL: empty scopes = explicit "no permissions", must NOT fall through to defaults
  it('returns empty array when zooid.dev/scopes is empty (public role with no scopes)', () => {
    expect(normalize({ 'https://zooid.dev/scopes': [] })).toEqual([]);
  });

  it('does not escalate empty zooid.dev/scopes to legacy scope parsing', () => {
    // If this falls through to legacy parsing, scope: "publish" would give pub:*
    // This would be a privilege escalation bug
    const result = normalize({
      'https://zooid.dev/scopes': [],
      scope: 'publish',
    } as unknown as ZooidJWT);
    expect(result).toEqual([]);
  });

  it('returns empty array when no scope claims present', () => {
    expect(normalize({})).toEqual([]);
  });

  it('handles legacy admin scope', () => {
    expect(normalize({ scope: 'admin' })).toEqual(['admin']);
  });

  it('handles legacy publish scope with channels', () => {
    expect(normalize({ scope: 'publish', channels: ['foo', 'bar'] })).toEqual([
      'pub:foo',
      'pub:bar',
    ]);
  });

  it('handles legacy subscribe scope with single channel', () => {
    expect(normalize({ scope: 'subscribe', channel: 'news' })).toEqual([
      'sub:news',
    ]);
  });

  it('handles legacy publish scope with no channels (wildcard)', () => {
    expect(normalize({ scope: 'publish' })).toEqual(['pub:*']);
  });
});
