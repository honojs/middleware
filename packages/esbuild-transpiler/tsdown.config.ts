import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: true,
  clean: true,
  dts: true,
  entry: ['src/*.ts', 'src/transpilers/*.ts'],
  external: ['esbuild-wasm', 'esbuild'],
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
})
