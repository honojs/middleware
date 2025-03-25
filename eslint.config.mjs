import { defineConfig, globalIgnores } from 'eslint/config'
import baseConfig from './packages/eslint-config/index.js'

export default defineConfig(globalIgnores(['.yarn', '**/dist']), {
  extends: baseConfig,
})
