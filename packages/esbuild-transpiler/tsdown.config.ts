import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  entry: {
    index: 'src/index.ts',
    node: 'src/transpilers/node.ts',
    wasm: 'src/transpilers/wasm.ts',
  },
  external: ['esbuild-wasm', 'esbuild'],
})
