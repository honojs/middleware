/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  displayName: 'hono',
  injectGlobals: true,
  testMatch: ['**/test/**/*.+(ts|tsx|js)', '**/src/**/(*.)+(spec|test).+(ts|tsx|js)'],
  transform: { '^.+\\.m?tsx?$': 'ts-jest' },
  testPathIgnorePatterns: ['/node_modules/', '/jest/'],
}
