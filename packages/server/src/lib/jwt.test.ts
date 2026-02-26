import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
  createToken,
  verifyToken,
  createEdDSAToken,
  verifyEdDSAToken,
  verifyTokenAny,
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
    max_scope: null,
    allowed_channels: null,
    issuer: 'local',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('JWT', () => {
  describe('HS256 (legacy)', () => {
    describe('createToken', () => {
      it('creates a valid admin token', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET);
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
      });

      it('creates a publish token scoped to a channel', async () => {
        const token = await createToken(
          { scope: 'publish', channel: 'test-channel' },
          TEST_SECRET,
        );
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.scope).toBe('publish');
        expect(payload.channel).toBe('test-channel');
      });

      it('creates a subscribe token scoped to a channel', async () => {
        const token = await createToken(
          { scope: 'subscribe', channel: 'test-channel' },
          TEST_SECRET,
        );
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.scope).toBe('subscribe');
        expect(payload.channel).toBe('test-channel');
      });

      it('includes sub claim when provided', async () => {
        const token = await createToken(
          { scope: 'publish', channel: 'test-channel', sub: 'bot-1' },
          TEST_SECRET,
        );
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.sub).toBe('bot-1');
      });

      it('includes iat claim', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET);
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.iat).toBeTypeOf('number');
      });

      it('includes exp claim when expiry is provided', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET, {
          expiresIn: 3600,
        });
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.exp).toBeTypeOf('number');
        expect(payload.exp! - payload.iat).toBe(3600);
      });

      it('omits exp claim when no expiry', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET);
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.exp).toBeUndefined();
      });
    });

    describe('verifyToken', () => {
      it('verifies a valid token', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET);
        const payload = await verifyToken(token, TEST_SECRET);
        expect(payload.scope).toBe('admin');
      });

      it('rejects a token signed with a different secret', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET);
        await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow();
      });

      it('rejects a malformed token', async () => {
        await expect(verifyToken('not-a-jwt', TEST_SECRET)).rejects.toThrow();
      });

      it('rejects an expired token', async () => {
        const token = await createToken({ scope: 'admin' }, TEST_SECRET, {
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
          { scope: 'admin' },
          privateJwk,
          'test-1',
        );
        expect(token.split('.')).toHaveLength(3);
      });

      it('includes kid in the header', async () => {
        const token = await createEdDSAToken(
          { scope: 'admin' },
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
          { scope: 'publish', channels: ['test-ch'], sub: 'bot-1' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scope).toBe('publish');
        expect(payload.channels).toEqual(['test-ch']);
        expect(payload.sub).toBe('bot-1');
        expect(payload.iat).toBeTypeOf('number');
      });

      it('includes exp when expiresIn is set', async () => {
        const token = await createEdDSAToken(
          { scope: 'admin' },
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
          { scope: 'admin' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk);
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scope).toBe('admin');
      });

      it('rejects a token signed with a different key', async () => {
        const other = await generateTestKeypair();
        const token = await createEdDSAToken(
          { scope: 'admin' },
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
          { scope: 'admin' },
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

      it('enforces scope ceiling — publish key cannot verify admin token', async () => {
        const token = await createEdDSAToken(
          { scope: 'admin' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scope: 'publish',
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Scope exceeds key ceiling',
        );
      });

      it('allows scope within ceiling — publish key verifies publish token', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['ch'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scope: 'publish',
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scope).toBe('publish');
      });

      it('allows scope within ceiling — publish key verifies subscribe token', async () => {
        const token = await createEdDSAToken(
          { scope: 'subscribe', channels: ['ch'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          max_scope: 'publish',
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scope).toBe('subscribe');
      });

      it('no ceiling (null max_scope) allows admin tokens', async () => {
        const token = await createEdDSAToken(
          { scope: 'admin' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, { max_scope: null });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scope).toBe('admin');
      });
    });

    describe('channel allowlist', () => {
      it('allows exact channel match', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['crypto-signals'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['crypto-signals', 'market-data']),
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.channels).toEqual(['crypto-signals']);
      });

      it('rejects channel not in allowlist', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['secret-internal'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['crypto-signals']),
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Channel "secret-internal" not allowed for this key',
        );
      });

      it('allows prefix wildcard match', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['build-artifacts.main'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['build-artifacts.*']),
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.channels).toEqual(['build-artifacts.main']);
      });

      it('rejects channel that does not match prefix', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['other-artifacts.main'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['build-artifacts.*']),
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Channel "other-artifacts.main" not allowed for this key',
        );
      });

      it('allows mix of exact and prefix entries', async () => {
        const token = await createEdDSAToken(
          {
            scope: 'publish',
            channels: ['crypto-signals', 'build-artifacts.staging'],
          },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify([
            'crypto-signals',
            'build-artifacts.*',
          ]),
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.channels).toEqual([
          'crypto-signals',
          'build-artifacts.staging',
        ]);
      });

      it('rejects if any channel in multi-channel token is not allowed', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['crypto-signals', 'secret-internal'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['crypto-signals']),
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Channel "secret-internal" not allowed for this key',
        );
      });

      it('allows any channel when allowed_channels is null', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channels: ['anything-goes'] },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: null,
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.channels).toEqual(['anything-goes']);
      });

      it('works with legacy single-channel claim', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channel: 'crypto-signals' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['crypto-signals']),
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.channel).toBe('crypto-signals');
      });

      it('rejects legacy single-channel claim not in allowlist', async () => {
        const token = await createEdDSAToken(
          { scope: 'publish', channel: 'secret-internal' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['crypto-signals']),
        });
        await expect(verifyEdDSAToken(token, keyRow)).rejects.toThrow(
          'Channel "secret-internal" not allowed for this key',
        );
      });

      it('allows admin tokens with no channels even when allowlist is set', async () => {
        const token = await createEdDSAToken(
          { scope: 'admin' },
          privateJwk,
          'test-1',
        );
        const keyRow = makeTrustedKeyRow(publicJwk, {
          allowed_channels: JSON.stringify(['crypto-signals']),
        });
        const payload = await verifyEdDSAToken(token, keyRow);
        expect(payload.scope).toBe('admin');
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
      expect(result.payload.scope).toBe('admin');
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
        { scope: 'admin' },
        privateJwk,
        'dual-test-1',
      );
      const result = await verifyTokenAny(token, {
        ZOOID_JWT_SECRET: TEST_SECRET,
        DB: env.DB,
      });
      expect(result.payload.scope).toBe('admin');
      expect(result.kid).toBe('dual-test-1');

      // Cleanup
      await env.DB.prepare('DELETE FROM trusted_keys WHERE kid = ?')
        .bind('dual-test-1')
        .run();
    });

    it('rejects EdDSA token with unknown kid', async () => {
      const token = await createEdDSAToken(
        { scope: 'admin' },
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
        { scope: 'admin' },
        privateJwk,
        'no-key',
      );
      await expect(verifyTokenAny(token, { DB: env.DB })).rejects.toThrow();
    });
  });
});
