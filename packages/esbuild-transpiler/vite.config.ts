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
      node: 'src/transpilers/node.ts',
      wasm: 'src/transpilers/wasm.ts',
    },
    deps: { neverBundle: ['esbuild-wasm', 'esbuild'] },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
