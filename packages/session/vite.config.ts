import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: ['src/index.ts', 'src/cookies.ts', 'src/helper/testing/index.ts'],
  },
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
  },
})
