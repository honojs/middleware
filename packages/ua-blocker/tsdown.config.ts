import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  clean: true,
  dts: true,
  entry: ['src/index.ts', 'src/ai-bots.ts'],
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
})
