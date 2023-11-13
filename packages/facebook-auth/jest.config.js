module.exports = {
  ...require('../../jest.config.js'),
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  modulePathIgnorePatterns: ['handlers']
}
