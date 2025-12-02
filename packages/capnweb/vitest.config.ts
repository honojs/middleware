import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.node.test.ts'],
    environment: 'node',
    globals: true,
  },
})
