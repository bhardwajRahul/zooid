import { describe, it, expect } from 'vitest';
import { resolveScopes, type OIDCClaims } from './scope-mapper';

function resolve(
  claims: Partial<OIDCClaims>,
  env: { ZOOID_SCOPE_MAPPING?: string; ZOOID_AUTH_MAX_SCOPES?: string } = {},
) {
  return resolveScopes({ sub: 'user-1', ...claims }, env);
}

describe('resolveScopes — empty scopes escalation prevention', () => {
  // CRITICAL: These tests verify that an empty zooid.dev/scopes claim
  // (e.g. from a "public" role with no permissions) does NOT escalate
  // to the default pub:*/sub:* scopes. This was a real privilege escalation bug.

  it('empty zooid.dev/scopes returns no scopes (not pub:*/sub:*)', () => {
    const result = resolve({ 'https://zooid.dev/scopes': [] });
    expect(result.scopes).toEqual([]);
  });

  it('empty zooid.dev/scopes does not fall through to tier 2 mapping', () => {
    const result = resolve(
      { 'https://zooid.dev/scopes': [], groups: ['member'] },
      { ZOOID_SCOPE_MAPPING: '{"member":["pub:*","sub:*"]}' },
    );
    expect(result.scopes).toEqual([]);
  });

  it('empty zooid.dev/scopes does not fall through to tier 3 default', () => {
    const result = resolve({ 'https://zooid.dev/scopes': [] });
    expect(result.scopes).not.toContain('pub:*');
    expect(result.scopes).not.toContain('sub:*');
  });

  it('non-empty zooid.dev/scopes still works normally', () => {
    const result = resolve({
      'https://zooid.dev/scopes': ['pub:support', 'sub:support'],
    });
    expect(result.scopes).toEqual(['pub:support', 'sub:support']);
  });

  it('absent zooid.dev/scopes still falls through to defaults', () => {
    const result = resolve({});
    expect(result.scopes).toEqual(['pub:*', 'sub:*']);
  });
});
