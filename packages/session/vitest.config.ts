import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2025-03-10',
        kvNamespaces: ['SESSION_KV'],
      },
    }),
  ],
  test: {
    clearMocks: true,
    globals: true,
    include: ['examples/**/*.test.ts', 'src/**/*.test.ts'],
    restoreMocks: true,
    retry: 3,
  },
})
