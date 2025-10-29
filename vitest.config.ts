import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['packages/ua-blocker/script/**', ...coverageConfigDefaults.exclude],
      // TODO: use v8 - https://github.com/vitest-dev/vitest/issues/5783
      provider: 'istanbul',
      thresholds: {
        autoUpdate: true,
      },
    },
    projects: ['packages/*/vitest.config.ts'],
  },
})
