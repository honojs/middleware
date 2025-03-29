import baseConfig from '@hono/eslint-config'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(globalIgnores(['.yarn', '**/dist']), {
  extends: baseConfig,
})
