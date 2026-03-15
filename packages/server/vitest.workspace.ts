import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * Vitest workspace: runs route tests against both storage backends.
 *
 * - "do-backend": DO-per-channel (V2) — default
 * - "d1-backend": shared D1 (V1) — routes only, verifies backward compat
 *
 * Unit tests (lib/, do/, storage/) only run once since they test
 * backend internals directly, not through the route layer.
 */
export default [
  // Primary: all tests with DO backend (default from wrangler.toml)
  defineWorkersConfig({
    test: {
      name: 'do-backend',
      include: ['src/**/*.test.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            d1Databases: ['DB'],
            bindings: { ZOOID_STORAGE_BACKEND: 'do' },
          },
        },
      },
    },
  }),
  // Secondary: route tests only with D1 backend
  defineWorkersConfig({
    test: {
      name: 'd1-backend',
      include: ['src/routes/**/*.test.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            d1Databases: ['DB'],
            bindings: { ZOOID_STORAGE_BACKEND: 'd1' },
          },
        },
      },
    },
  }),
];
