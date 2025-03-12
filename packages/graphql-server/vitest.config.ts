import { defaultExclude, defineProject } from 'vitest/config'

export default defineProject({
  test: {
    exclude: [...defaultExclude, 'bun_test'],
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
})
