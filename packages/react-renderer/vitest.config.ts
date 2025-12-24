import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2024-01-01',
        compatibilityFlags: ['nodejs_compat'],
      },
    }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.test.ts?(x)'],
  },
})
