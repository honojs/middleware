import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: ['src/index.ts', 'src/ai-bots.ts'],
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
