import UnpluginTypia from '@ryoppippi/unplugin-typia/vite'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [
    UnpluginTypia({
      tsconfig: './tsconfig.build.json',
    }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
