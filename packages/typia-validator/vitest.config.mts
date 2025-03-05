import UnpluginTypia from '@ryoppippi/unplugin-typia/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    UnpluginTypia({
      tsconfig: './tsconfig.json',
    }),
  ],
  test: {
    globals: true,
  },
})
