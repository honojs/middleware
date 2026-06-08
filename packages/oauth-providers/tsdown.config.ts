import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  entry: {
    index: 'src/index.ts',
    '*': 'src/providers/*/index.ts',
  },
})
