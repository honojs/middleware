import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    globals: true,
    typecheck: {
      tsconfig: './tsconfig.json',
      enabled: true,
    },
  },
})
