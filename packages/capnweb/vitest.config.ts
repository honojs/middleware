import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    projects: [
      // Cloudflare Workers environment
      {
        ...defineWorkersConfig({
          test: {
            name: 'workerd',
            include: ['src/**/*.test.ts'],
            exclude: ['src/**/*.node.test.ts'],
            globals: true,
            restoreMocks: true,
            unstubEnvs: true,
            poolOptions: {
              workers: {
                wrangler: {
                  configPath: './mock/wrangler.jsonc',
                },
              },
            },
          },
        }),
      },
      // Node.js environment
      {
        test: {
          name: 'node',
          include: ['src/**/*.node.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
    ],
  },
})
