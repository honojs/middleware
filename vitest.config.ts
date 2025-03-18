import { defineConfig, coverageConfigDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/dist/**', ...coverageConfigDefaults.exclude],
      // TODO: use v8 - https://github.com/vitest-dev/vitest/issues/5783
      provider: 'istanbul',
      thresholds: {
        autoUpdate: true,
      },
    },
  },
})
