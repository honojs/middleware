import baseConfig from './packages/eslint-config/index.js'

export default [
  ...baseConfig,
  {
    ignores: ['**/dist/*'],
  },
]
