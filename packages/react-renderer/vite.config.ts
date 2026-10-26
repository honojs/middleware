import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    entry: 'src/index.ts',
  },
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
