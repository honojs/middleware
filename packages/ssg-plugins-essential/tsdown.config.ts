import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  clean: true,
  dts: true,
  entry: 'src/plugins/*.ts',
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
})
