import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersProject({
  test: {
    globals: true,
    include: ['examples/**/*.test.ts', 'src/**/*.test.ts'],
    restoreMocks: true,
    poolOptions: {
      workers: {
        singleWorker: true,
        miniflare: {
          compatibilityDate: '2025-03-10',
          kvNamespaces: ['SESSION_KV'],
        },
      },
    },
  },
})
