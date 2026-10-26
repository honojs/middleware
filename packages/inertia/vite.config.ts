import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    entry: ['src/index.ts', 'src/vite.ts'],
    deps: { neverBundle: ['vite'] },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
