module.exports = {
  testMatch: [
    "**/test/**/*.+(ts|tsx|js)",
    "**/src/**/(*.)+(spec|test).+(ts|tsx|js)",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testEnvironment: "miniflare",
  testEnvironmentOptions: {
    kvNamespaces: ["PUBLIC_JWK_CACHE_KV"],
  },
};
