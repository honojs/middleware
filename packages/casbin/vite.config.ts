import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: ['src/index.ts', 'src/helper/index.ts'],
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    // See https://github.com/vitest-dev/vitest/issues/5277
    pool: 'forks',
    setupFiles: ['./vitest.setup.ts'],
  },
})
