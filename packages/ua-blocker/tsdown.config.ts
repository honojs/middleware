import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  entry: ['src/index.ts', 'src/ai-bots.ts'],
})
