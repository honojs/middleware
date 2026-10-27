import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    entry: 'src/index.ts',
    deps: { neverBundle: ['bun'] },
  },
})
