import { defineConfig } from 'tsdown'

export default defineConfig({
  deps: {
    alwaysBundle: [/^ohash(?:\/|$)/],
  },
  entry: 'src/index.ts',
  fixedExtension: true,
  platform: 'neutral',
})
