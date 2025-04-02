import { defineConfig } from 'tsup'

export default defineConfig((overrideOptions) => ({
  ...overrideOptions,
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  outDir: 'dist',
  tsconfig: 'tsconfig.tsup.json',
}))
