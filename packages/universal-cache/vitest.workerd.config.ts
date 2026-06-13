import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineProject } from 'vitest/config'

const workerdPlugin = cloudflareTest({
  miniflare: {
    compatibilityDate: '2025-03-10',
    compatibilityFlags: ['nodejs_compat'],
  },
}) as never

export default defineProject({
  plugins: [workerdPlugin],
  test: {
    globals: true,
    include: ['src/**/*.workerd.test.ts'],
  },
})
