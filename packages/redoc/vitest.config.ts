import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['cobertura', 'lcov', 'json', 'html', 'text', 'text-summary'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      watermarks: {
        lines: [50, 80],
        functions: [50, 80],
        branches: [50, 80],
        statements: [50, 80],
      },
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
    },
  },
})
