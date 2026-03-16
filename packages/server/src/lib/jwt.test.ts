import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
  createToken,
  verifyToken,
  createEdDSAToken,
  verifyEdDSAToken,
  verifyTokenAny,
  mintServerToken,
  normalizeScopes,
  hasScope,
  canPublish,
  canSubscribe,
  isAdmin,
  enforceScopeCeiling,
  scopeMatchesPattern,
} from './jwt';
import { setupTestDb } from '../test-utils';
import type { TrustedKeyRow } from '../types';

const TEST_SECRET = 'test-secret-key-for-jwt-testing-purposes';

// Generate a test Ed25519 keypair and export as JWK
async function generateTestKeypair() {
  const keypair = await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ]);
  const privateJwk = await crypto.subtle.exportKey(
    'jwk',
    (keypair as CryptoKeyPair).privateKey,
  );
  const publicJwk = await crypto.subtle.exportKey(
    'jwk',
    (keypair as CryptoKeyPair).publicKey,
  );
  return { privateJwk, publicJwk };
}

function makeTrustedKeyRow(
  publicJwk: JsonWebKey,
  overrides?: Partial<TrustedKeyRow>,
): TrustedKeyRow {
  return {
    kid: 'test-1',
    kty: publicJwk.kty!,
    crv: (publicJwk as { crv?: string }).crv!,
    x: publicJwk.x!,
    max_scopes: null,
    issuer: 'local',
    jwks_url: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('JWT', () => {
  describe('normalizeScopes', () => {
    it('passes through new scopes array', () => {
      expect(
        normalizeScopes({ scopes: ['pub:foo', 'sub:bar'], iat: 0 }),
      ).toEqual(['pub:foo', 'sub:bar']);
    });

    it('normalizes legacy admin scope', () => {
      expect(normalizeScopes({ scope: 'admin', iat: 0 })).toEqual(['admin']);
    });

    it('normalizes legacy publish with channels', () => {
      expect(
        normalizeScopes({ scope: 'publish', channels: ['foo', 'bar'], iat: 0 }),
      ).toEqual(['pub:foo', 'pub:bar']);
    });

    it('normalizes legacy subscribe with single channel', () => {
      expect(
        normalizeScopes({ scope: 'subscribe', channel: 'foo', iat: 0 }),
      ).toEqual(['sub:foo']);
    });

    it('normalizes legacy publish without channels to wildcard', () => {
      expect(normalizeScopes({ scope: 'publish', iat: 0 })).toEqual(['pub:*']);
    });
  });

  describe('scopeMatchesPattern', () => {
    it('exact match', () => {
      expect(scopeMatchesPattern('pub:foo', 'pub:foo')).toBe(true);
      expect(scopeMatchesPattern('pub:foo', 'pub:bar')).toBe(false);
    });

    it('wildcard match', () => {
      expect(scopeMatchesPattern('pub:anything', 'pub:*')).toBe(true);
      expect(scopeMatchesPattern('sub:anything', 'pub:*')).toBe(false);
    });

    it('prefix wildcard match', () => {
      expect(scopeMatchesPattern('pub:product-foo', 'pub:product-*')).toBe(
        true,
      );
      expect(scopeMatchesPattern('pub:other-foo', 'pub:product-*')).toBe(false);
    });

    it('admin pattern matches everything', () => {
      expect(scopeMatchesPattern('pub:foo', 'admin')).toBe(true);
      expect(scopeMatchesPattern('sub:bar', 'admin')).toBe(true);
      expect(scopeMatchesPattern('admin', 'admin')).toBe(true);
    });
  });

  describe('hasScope / canPublish / canSubscribe / isAdmin', () => {
    it('admin scope grants everything', () => {
      const scopes = ['admin'];
      expect(hasScope(scopes, 'pub:foo')).toBe(true);
      expect(hasScope(scopes, 'sub:bar')).toBe(true);
      expect(canPublish(scopes, 'anything')).toBe(true);
      expect(canSubscribe(scopes, 'anything')).toBe(true);
      expect(isAdmin(scopes)).toBe(true);
    });

    it('pub scope grants publish to specific channel', () => {
      const scopes = ['pub:foo'];
      expect(canPublish(scopes, 'foo')).toBe(true);
      expect(canPublish(scopes, 'bar')).toBe(false);
      expect(canSubscribe(scopes, 'foo')).toBe(false);
      expect(isAdmin(scopes)).toBe(false);
    });

    it('wildcard pub scope grants publish to any channel', () => {
      const scopes = ['pub:*'];
      expect(canPublish(scopes, 'foo')).toBe(true);
      expect(canPublish(scopes, 'bar')).toBe(true);
      expect(canSubscribe(scopes, 'foo')).toBe(false);
    });

    it('prefix wildcard works', () => {
      const scopes = ['pub:product-*', 'sub:product-*'];
      expect(canPublish(scopes, 'product-signals')).toBe(true);
      expect(canPublish(scopes, 'other-signals')).toBe(false);
      expect(canSubscribe(scopes, 'product-logs')).toBe(true);
    });

    it('combined pub+sub scopes', () => {
      const scopes = ['pub:reddit-scout', 'sub:reddit-drafts'];
      expect(canPublish(scopes, 'reddit-scout')).toBe(true);
      expect(canSubscribe(scopes, 'reddit-drafts')).toBe(true);
      expect(canPublish(scopes, 'reddit-drafts')).toBe(false);
      expect(canSubscribe(scopes, 'reddit-scout')).toBe(false);
    });
  });

  describe('enforceScopeCeiling', () => {
    it('null ceiling allows everything', () => {
      expect(() => enforceScopeCeiling(['admin'], null)).not.toThrow();
    });

    it('ceiling allows matching scopes', () => {
      expect(() =>
        enforceScopeCeiling(['pub:foo', 'sub:foo'], ['pub:*', 'sub:*']),
      ).not.toThrow();
    });

    it('ceiling rejects non-matching scopes', () => {
      expect(() => enforceScopeCeiling(['admin'], ['pub:*', 'sub:*'])).toThrow(
        'Scope "admin" exceeds key ceiling',
      );
    });

    it('ceiling with prefix patterns', () => {
      expect(() =>
        enforceScopeCeiling(['pub:product-foo'], ['pub:product-*']),
      ).not.toThrow();
      expect(() =>
        enforceScopeCeiling(['pub:other-foo'], ['pub:product-*']),
      ).toThrow();
    });
  });

  describe('HS256 (legacy)', () => {
    describe('createToken', () => {
      it('creates a valid token with scopes', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET);
        expect(token).toBeTruthy();
        expect(token.split('.')).toHaveLength(3);
      });

      it('creates a token with legacy scope claim', async () => {
        const token = await createToken(
          { scope: 'publish', channel: 'test-channel' },
          TEST_SECRET,
        );
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.scope).toBe('publish');
        expect(payload.channel).toBe('test-channel');
      });

      it('includes sub claim when provided', async () => {
        const token = await createToken(
          { scopes: ['pub:test-channel'], sub: 'bot-1' },
          TEST_SECRET,
        );
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.sub).toBe('bot-1');
      });

      it('includes iat claim', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET);
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.iat).toBeTypeOf('number');
      });

      it('includes exp claim when expiry is provided', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET, {
          expiresIn: 3600,
        });
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.exp).toBeTypeOf('number');
        expect(payload.exp! - payload.iat).toBe(3600);
      });

      it('omits exp claim when no expiry', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET);
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.exp).toBeUndefined();
      });
    });

    describe('verifyToken', () => {
      it('verifies a valid token', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET);
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.scopes).toEqual(['admin']);
      });

      it('rejects a token signed with a different secret', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET);
        await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow();
      });

      it('rejects a malformed token', async () => {
        await expect(verifyToken('not-a-jwt', TEST_SECRET)).rejects.toThrow();
      });

      it('rejects an expired token', async () => {
        const token = await createToken({ scopes: ['admin'] }, TEST_SECRET, {
          expiresIn: -1,
        });
        await expect(verifyToken(token, TEST_SECRET)).rejects.toThrow();
      });
    });
  });

  describe('EdDSA', () => {
    let privateJwk: JsonWebKey;
    let publicJwk: JsonWebKey;

    beforeAll(async () => {
      const keypair = await generateTestKeypair();
      privateJwk = keypair.privateJwk;
      publicJwk = keypair.publicJwk;
    });

    describe('createEdDSAToken', () => {
      it('creates a valid 3-part JWT', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'test-1',
        );
        expect(token.split('.')).toHaveLength(3);
      });

      it('includes kid in the header', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'my-kid',
        );
        const headerB64 = token.split('.')[0];
        const padded =
          headerB64.replace(/-/g, '+').replace(/_/g, '/') +
          '='.repeat((4 - (headerB64.length % 4)) % 4);
        const header = JSON.parse(atob(padded));
        expect(header.alg).toBe('EdDSA');
        expect(header.kid).toBe('my-kid');
        expect(header.typ).toBe('JWT');
      });

      it('includes claims in the payload', async () => {
        const token = await createEdDSAToken(
          { scopes: ['pub:test-ch'], sub: 'bot-1' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scopes).toEqual(['pub:test-ch']);
        expect(payload.sub).toBe('bot-1');
        expect(payload.iat).toBeTypeOf('number');
      });

      it('includes exp when expiresIn is set', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'test-1',
          { expiresIn: 3600 },
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.exp).toBeTypeOf('number');
        expect(payload.exp! - payload.iat).toBe(3600);
      });
    });

    describe('verifyEdDSAToken', () => {
      it('verifies a valid token', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scopes).toEqual(['admin']);
      });

      it('rejects a token signed with a different key', async () => {
        const other = await generateTestKeypair();
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          other.privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Invalid signature',
        );
      });

      it('rejects an expired token', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'test-1',
          { expiresIn: -1 },
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Token expired',
        );
      });

      it('rejects a malformed token', async () => {
        const keyRow = makeTrustedKeyRow(publicJwk);
        await expect(verifyEdDSAToken('not.a.jwt', keyRow)).rejects.toThrow();
      });

      it('enforces scope ceiling — pub-only key rejects admin token', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scopes: JSON.stringify(['pub:*', 'sub:*']),
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'exceeds key ceiling',
        );
      });

      it('allows scope within ceiling', async () => {
        const token = await createEdDSAToken(
          { scopes: ['pub:ch', 'sub:ch'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scopes: JSON.stringify(['pub:*', 'sub:*']),
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scopes).toEqual(['pub:ch', 'sub:ch']);
      });

      it('enforces channel-scoped ceiling', async () => {
        const token = await createEdDSAToken(
          { scopes: ['pub:secret-channel'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scopes: JSON.stringify(['pub:product-*']),
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'exceeds key ceiling',
        );
      });

      it('no ceiling (null max_scopes) allows all tokens', async () => {
        const token = await createEdDSAToken(
          { scopes: ['admin'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, { max_scopes: null });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scopes).toEqual(['admin']);
      });

      it('normalizes legacy tokens through ceiling check', async () => {
        // Legacy token with scope: 'publish', channels: ['foo']
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['foo'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scopes: JSON.stringify(['pub:foo']),
        });
        // Should pass — legacy normalizes to pub:foo which matches
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(normalizeScopes(payload)).toEqual(['pub:foo']);
      });
    });
  });

  describe('verifyTokenAny (dual verification)', () => {
    let privateJwk: JsonWebKey;
    let publicJwk: JsonWebKey;

    beforeAll(async () => {
      await setupTestDb();
      const keypair = await generateTestKeypair();
      privateJwk = keypair.privateJwk;
      publicJwk = keypair.publicJwk;
    });

    it('verifies an HS256 token via legacy path', async () => {
      const token = await createToken({ scope: 'admin' }, TEST_SECRET);
      const result = await verifyTokenAny(token, {
        ZOOID_JWT_SECRET: TEST_SECRET,
        DB: env.DB,
      });
      expect(normalizeScopes(result.payload)).toEqual(['admin']);
      expect(result.kid).toBeUndefined();
    });

    it('verifies an EdDSA token via JWKS path', async () => {
      // Insert trusted key into D1
      await env.DB.prepare(
        'INSERT INTO trusted_keys (kid, kty, crv, x, issuer) VALUES (?, ?, ?, ?, ?)',
      )
        .bind('dual-test-1', publicJwk.kty!, 'Ed25519', publicJwk.x!, 'local')
        .run();

      const token = await createEdDSAToken(
        { scopes: ['admin'] },
        privateJwk,
        'dual-test-1',
      );
      const result = await verifyTokenAny(token, {
        ZOOID_JWT_SECRET: TEST_SECRET,
        DB: env.DB,
      });
      expect(result.payload.scopes).toEqual(['admin']);
      expect(result.kid).toBe('dual-test-1');

      // Cleanup
      await env.DB.prepare('DELETE FROM trusted_keys WHERE kid = ?')
        .bind('dual-test-1')
        .run();
    });

    it('rejects EdDSA token with unknown kid', async () => {
      const token = await createEdDSAToken(
        { scopes: ['admin'] },
        privateJwk,
        'unknown-kid',
      );
      await expect(
        verifyTokenAny(token, {
          ZOOID_JWT_SECRET: TEST_SECRET,
          DB: env.DB,
        }),
      ).rejects.toThrow('Unknown key ID');
    });

    it('rejects completely malformed tokens', async () => {
      await expect(
        verifyTokenAny('garbage', {
          ZOOID_JWT_SECRET: TEST_SECRET,
          DB: env.DB,
        }),
      ).rejects.toThrow();
    });

    it('rejects when no matching verification method exists', async () => {
      // EdDSA token without JWKS entry and no HS256 secret
      const token = await createEdDSAToken(
        { scopes: ['admin'] },
        privateJwk,
        'no-key',
      );
      await expect(verifyTokenAny(token, { DB: env.DB })).rejects.toThrow();
    });
  });

  describe('groups claim', () => {
    let testPrivateJwk: JsonWebKey;
    let testKeyRow: TrustedKeyRow;

    beforeAll(async () => {
      await setupTestDb();
      const keypair = await generateTestKeypair();
      testPrivateJwk = keypair.privateJwk;
      testKeyRow = makeTrustedKeyRow(keypair.publicJwk);
    });

    it('should round-trip groups in HS256 token', async () => {
      const token = await createToken(
        {
          scopes: ['pub:current', 'sub:current'],
          sub: 'agent:test',
          groups: ['qa'],
        },
        TEST_SECRET,
      );
      const payload = await verifyToken(token, TEST_SECRET);
      expect(payload.groups).toEqual(['qa']);
    });

    it('should round-trip groups in EdDSA token', async () => {
      const token = await createEdDSAToken(
        {
          scopes: ['pub:current'],
          sub: 'agent:test',
          groups: ['qa', 'engineer'],
        },
        testPrivateJwk,
        testKeyRow.kid,
      );
      const payload = await verifyEdDSAToken(token, testKeyRow);
      expect(payload.groups).toEqual(['qa', 'engineer']);
    });

    it('should omit groups when not provided', async () => {
      const token = await createToken(
        { scopes: ['pub:current'], sub: 'agent:test' },
        TEST_SECRET,
      );
      const payload = await verifyToken(token, TEST_SECRET);
      expect(payload.groups).toBeUndefined();
    });

    it('should preserve groups through mintServerToken', async () => {
      const token = await mintServerToken(
        { scopes: ['pub:current'], sub: 'agent:test', groups: ['qa'] },
        { ZOOID_JWT_SECRET: TEST_SECRET, DB: env.DB },
      );
      const { payload } = await verifyTokenAny(token, {
        ZOOID_JWT_SECRET: TEST_SECRET,
        DB: env.DB,
      });
      expect(payload.groups).toEqual(['qa']);
    });
  });
});
