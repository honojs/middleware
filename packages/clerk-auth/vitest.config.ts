import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
})
