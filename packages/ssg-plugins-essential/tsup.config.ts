import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/plugins/*.ts', '!src/plugins/*.test.ts'],
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  outDir: 'dist',
  tsconfig: '../../tsconfig.tsup.json',
})
