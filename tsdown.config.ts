import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: true,
  dts: {
    sourcemap: true,
  },
  exports: true,
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
  workspace: true,
})
