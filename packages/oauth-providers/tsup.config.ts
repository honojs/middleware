import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/providers/**/index.ts', 'src/providers/**/types.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
})
