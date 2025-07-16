import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    // See https://github.com/vitest-dev/vitest/issues/5277
    pool: 'forks',
    setupFiles: ['./vitest.setup.ts'],
  },
})
