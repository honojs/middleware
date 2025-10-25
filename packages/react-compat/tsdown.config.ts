import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: true,
  clean: true,
  dts: true,
  entry: 'src/*.ts',
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
})
