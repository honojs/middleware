import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersProject({
  test: {
    globals: true,
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
