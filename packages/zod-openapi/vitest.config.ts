/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    typecheck: {
      tsconfig: './tsconfig.vitest.json',
    },
  },
})
