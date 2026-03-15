import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

const sharedConfig = {
  poolOptions: {
    workers: {
      wrangler: {
        configPath: './wrangler.toml',
      },
      miniflare: {
        d1Databases: ['DB'],
      },
    },
  },
};

export default defineWorkersConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utils.ts'],
    },
    ...sharedConfig,
  },
});
