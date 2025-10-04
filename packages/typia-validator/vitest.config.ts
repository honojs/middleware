import UnpluginTypia from '@ryoppippi/unplugin-typia/vite'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [
    // https://github.com/honojs/middleware/pull/1489#pullrequestreview-3301048779
    //
    // UnpluginTypia({
    //   tsconfig: './tsconfig.build.json',
    // }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
