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
    vars: {
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      PUBLIC_JWK_CACHE_KEY: "testing-cache-key",
    },
    bindings: {
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      PUBLIC_JWK_CACHE_KEY: "testing-cache-key",
    },
    kvNamespaces: ["PUBLIC_JWK_CACHE_KV"],
  },
};
