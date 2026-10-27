import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: {
      index: 'src/index.ts',
      auth: 'src/auth/index.ts',
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
