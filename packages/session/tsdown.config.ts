import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  entry: ['src/index.ts', 'src/cookies.ts', 'src/helper/testing/index.ts'],
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
})
