import { describe, it, expect } from 'vitest';
import { resolveScopes, type OIDCClaims } from './scope-mapper';

function resolve(
  claims: Partial<OIDCClaims>,
  env: { ZOOID_SCOPE_MAPPING?: string; ZOOID_AUTH_MAX_SCOPES?: string } = {},
) {
  return resolveScopes({ sub: 'user-1', ...claims }, env);
}

describe('resolveScopes', () => {
  // --- Tier resolution ---

  it('uses https://zooid.dev/scopes claim when present (tier 1)', () => {
    const result = resolve({ 'https://zooid.dev/scopes': ['admin'] });
    expect(result.scopes).toEqual(['admin']);
  });

  it('uses role mapping when configured (tier 2)', () => {
    const result = resolve(
      { groups: ['editor'] },
      {
        ZOOID_SCOPE_MAPPING: '{"editor":["pub:*","sub:*"],"viewer":["sub:*"]}',
      },
    );
    expect(result.scopes).toEqual(['pub:*', 'sub:*']);
  });

  it('combines scopes from multiple groups (tier 2)', () => {
    const result = resolve(
      { groups: ['viewer', 'editor'] },
      { ZOOID_SCOPE_MAPPING: '{"editor":["pub:news"],"viewer":["sub:*"]}' },
    );
    expect(result.scopes).toContain('pub:news');
    expect(result.scopes).toContain('sub:*');
  });

  it('falls back to default scopes (tier 3)', () => {
    const result = resolve({});
    expect(result.scopes).toEqual(['pub:*', 'sub:*']);
  });

  // --- Max scopes intersection ---

  describe('ZOOID_AUTH_MAX_SCOPES intersection', () => {
    it('exact match passes through', () => {
      const result = resolve(
        { 'https://zooid.dev/scopes': ['pub:news', 'sub:news'] },
        { ZOOID_AUTH_MAX_SCOPES: '["pub:news","sub:news"]' },
      );
      expect(result.scopes).toEqual(['pub:news', 'sub:news']);
    });

    it('wildcard scope narrowed to specific ceiling entries', () => {
      const result = resolve(
        {},
        {
          ZOOID_AUTH_MAX_SCOPES:
            '["pub:public-chatter","sub:reddit-scout","sub:ai-news","sub:public-chatter"]',
        },
      );
      expect(result.scopes).toContain('pub:public-chatter');
      expect(result.scopes).toContain('sub:reddit-scout');
      expect(result.scopes).toContain('sub:ai-news');
      expect(result.scopes).toContain('sub:public-chatter');
      expect(result.scopes).not.toContain('pub:*');
      expect(result.scopes).not.toContain('sub:*');
    });

    it('scope not in ceiling is dropped', () => {
      const result = resolve(
        { 'https://zooid.dev/scopes': ['pub:secret', 'sub:news'] },
        { ZOOID_AUTH_MAX_SCOPES: '["sub:news"]' },
      );
      expect(result.scopes).toEqual(['sub:news']);
    });

    it('admin in ceiling allows admin scope', () => {
      const result = resolve(
        { 'https://zooid.dev/scopes': ['admin'] },
        { ZOOID_AUTH_MAX_SCOPES: '["admin"]' },
      );
      expect(result.scopes).toEqual(['admin']);
    });

    it('admin scope blocked when not in ceiling', () => {
      const result = resolve(
        { 'https://zooid.dev/scopes': ['admin'] },
        { ZOOID_AUTH_MAX_SCOPES: '["pub:*","sub:*"]' },
      );
      expect(result.scopes).not.toContain('admin');
    });

    it('admin in ceiling does not bypass narrowing of other scopes', () => {
      const result = resolve(
        {},
        {
          ZOOID_AUTH_MAX_SCOPES:
            '["admin","pub:public-chatter","sub:reddit-scout","sub:ai-news"]',
        },
      );
      expect(result.scopes).toContain('pub:public-chatter');
      expect(result.scopes).toContain('sub:reddit-scout');
      expect(result.scopes).toContain('sub:ai-news');
      expect(result.scopes).not.toContain('pub:*');
      expect(result.scopes).not.toContain('sub:*');
      expect(result.scopes).not.toContain('admin');
    });

    it('prefix wildcard in ceiling narrows scope', () => {
      const result = resolve(
        {},
        { ZOOID_AUTH_MAX_SCOPES: '["pub:public-*","sub:*"]' },
      );
      expect(result.scopes).toContain('pub:public-*');
      expect(result.scopes).toContain('sub:*');
      expect(result.scopes).not.toContain('pub:*');
    });

    it('prefix wildcard scope narrowed by specific ceiling', () => {
      const result = resolve(
        { 'https://zooid.dev/scopes': ['pub:product-*', 'sub:*'] },
        {
          ZOOID_AUTH_MAX_SCOPES:
            '["pub:product-signals","pub:product-updates","sub:news"]',
        },
      );
      expect(result.scopes).toContain('pub:product-signals');
      expect(result.scopes).toContain('pub:product-updates');
      expect(result.scopes).toContain('sub:news');
      expect(result.scopes).not.toContain('pub:product-*');
      expect(result.scopes).not.toContain('sub:*');
    });

    it('no duplicates when scope and ceiling overlap', () => {
      const result = resolve(
        { 'https://zooid.dev/scopes': ['pub:news', 'pub:*'] },
        { ZOOID_AUTH_MAX_SCOPES: '["pub:news"]' },
      );
      expect(result.scopes).toEqual(['pub:news']);
    });

    it('empty ceiling results in empty scopes', () => {
      const result = resolve({}, { ZOOID_AUTH_MAX_SCOPES: '[]' });
      expect(result.scopes).toEqual([]);
    });

    it('no max_scopes returns scopes unchanged', () => {
      const result = resolve({});
      expect(result.scopes).toEqual(['pub:*', 'sub:*']);
    });
  });

  // --- Identity extraction ---

  it('extracts name from claims', () => {
    const result = resolve({ name: 'Alice' });
    expect(result.name).toBe('Alice');
  });

  it('falls back to preferred_username', () => {
    const result = resolve({ preferred_username: 'alice123' });
    expect(result.name).toBe('alice123');
  });

  it('falls back to email', () => {
    const result = resolve({ email: 'alice@example.com' });
    expect(result.name).toBe('alice@example.com');
  });
});
