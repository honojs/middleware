import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: true,
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
  workspace: true,
})
