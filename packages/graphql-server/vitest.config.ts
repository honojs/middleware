import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'bun_test'],
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    onConsoleLog(_, type) {
      // Do not show `console.error` messages
      if (type === 'stderr') {
        return false
      }
    },
  },
})
