import baseConfig from '@hono/eslint-config'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(
  globalIgnores(['.yarn', '**/coverage', '**/dist', '**/.cache', '**/.turbo']),
  {
    extends: baseConfig,

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  }
)
