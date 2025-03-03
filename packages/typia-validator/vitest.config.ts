import { defineConfig, defaultExclude } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    exclude: [...defaultExclude, 'tests'],
  },
})
