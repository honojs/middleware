const baseConfig = require('../../jest.config.js')

module.exports = {
  ...baseConfig,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true }],
  },
  extensionsToTreatAsEsm: ['.ts'],
}
