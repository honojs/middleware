module.exports = {
    testMatch: ['**/test-generated/**/*.+(ts|tsx|js)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.history/'],
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    testEnvironment: 'miniflare',
  }
  