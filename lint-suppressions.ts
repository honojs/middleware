type Suppression = {
  files: string[]
  rules: Record<string, 'off'>
}

export const suppressions: Suppression[] = [
  {
    files: ['packages/ajv-validator/src/index.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/arktype-validator/src/index.test.ts'],
    rules: {
      'typescript/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/arktype-validator/src/index.ts'],
    rules: {
      'typescript/no-dynamic-delete': 'off',
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/auth-js/src/client.ts'],
    rules: {
      'typescript/no-redundant-type-constituents': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/auth-js/src/index.test.ts'],
    rules: {
      'typescript/await-thenable': 'off',
      'typescript/no-unnecessary-type-conversion': 'off',
      'typescript/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/auth-js/src/react.tsx'],
    rules: {
      'typescript/no-floating-promises': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: [
      'packages/bun-compress/src/index.test.ts',
      'packages/effect-validator/src/index.test.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/bun-transpiler/src/index.ts'],
    rules: {
      'typescript/await-thenable': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/capnweb/src/index.test.ts'],
    rules: {
      'typescript/no-misused-promises': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: ['packages/capnweb/src/index.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/class-validator/src/index.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: [
      'packages/clerk-auth/src/clerk-auth.ts',
      'packages/oauth-providers/src/providers/github/authFlow.ts',
      'packages/oauth-providers/src/providers/linkedin/authFlow.ts',
    ],
    rules: {
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/conform-validator/src/hook.test.ts'],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: [
      'packages/conform-validator/src/index.ts',
      'packages/standard-validator/src/index.ts',
      'packages/valibot-validator/src/index.ts',
    ],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unnecessary-type-parameters': 'off',
      'typescript/no-unsafe-argument': 'off',
    },
  },
  {
    files: [
      'packages/conform-validator/src/valibot.test.ts',
      'packages/conform-validator/src/yup.test.ts',
      'packages/conform-validator/src/zod.test.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/effect-validator/src/index.ts'],
    rules: {
      'typescript/no-unnecessary-type-parameters': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/esbuild-transpiler/src/transpiler.ts'],
    rules: {
      'typescript/restrict-plus-operands': 'off',
    },
  },
  {
    files: ['packages/esbuild-transpiler/src/transpilers/wasm.ts'],
    rules: {
      'typescript/only-throw-error': 'off',
    },
  },
  {
    files: ['packages/esbuild-transpiler/src/types.esbuild.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
    },
  },
  {
    files: ['packages/event-emitter/src/index.test.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: ['packages/event-emitter/src/index.ts'],
    rules: {
      'typescript/no-floating-promises': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: [
      'packages/firebase-auth/src/index.test.ts',
      'packages/mcp/src/auth/helpers/revoke.ts',
      'packages/prometheus/src/index.test.ts',
    ],
    rules: {
      'typescript/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['packages/firebase-auth/src/index.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: [
      'packages/graphql-server/bun_test/index.test.ts',
      'packages/mcp/src/stores/memory.test.ts',
      'packages/session/src/index.test.ts',
      'packages/standard-validator/src/index.test.ts',
      'packages/trpc-server/src/context.test.ts',
      'packages/trpc-server/src/index.test.ts',
      'packages/typia-validator/src/http.test.ts',
      'packages/typia-validator/src/index.test.ts',
      'packages/ua-blocker/src/ai-bots.ts',
      'packages/zod-openapi/src/handler.test-d.ts',
      'packages/zod-validator/src/v3.test.ts',
    ],
    rules: {
      'typescript/require-await': 'off',
    },
  },
  {
    files: [
      'packages/graphql-server/src/index.test.ts',
      'packages/mcp/src/auth/helpers/token.ts',
      'packages/mcp/src/auth/middleware/client-auth.ts',
      'packages/react-renderer/src/react-renderer.test.tsx',
      'packages/ua-blocker/script/get-robots-txt.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/graphql-server/src/index.ts'],
    rules: {
      'typescript/no-base-to-string': 'off',
      'typescript/no-redundant-type-constituents': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-enum-comparison': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/graphql-server/src/parse-body.ts'],
    rules: {
      'typescript/no-unsafe-return': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/mcp/src/auth/helpers/authorize.test.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: [
      'packages/mcp/src/auth/helpers/register.test.ts',
      'packages/mcp/src/auth/helpers/revoke.test.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/mcp/src/auth/helpers/register.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-assignment': 'off',
    },
  },
  {
    files: [
      'packages/mcp/src/auth/helpers/token.test.ts',
      'packages/mcp/src/auth/middleware/client-auth.test.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: [
      'packages/mcp/src/auth/providers/proxy-provider.test.ts',
      'packages/mcp/src/auth/router.test.ts',
    ],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: [
      'packages/mcp/src/auth/providers/proxy-provider.ts',
      'packages/oidc-auth/src/index.test.ts',
    ],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/mcp/src/auth/router.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/mcp/src/stores/memory.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/mcp/src/streamable-http.test.ts'],
    rules: {
      'typescript/no-deprecated': 'off',
      'typescript/no-misused-promises': 'off',
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/mcp/src/streamable-http.ts'],
    rules: {
      'typescript/no-deprecated': 'off',
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/mcp/src/streaming.ts', 'packages/stytch-auth/src/index.test.ts'],
    rules: {
      'typescript/no-floating-promises': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/medley-router/src/router.ts'],
    rules: {
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/node-ws/src/index.test.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: ['packages/node-ws/src/index.ts'],
    rules: {
      'typescript/no-base-to-string': 'off',
      'typescript/no-floating-promises': 'off',
      'typescript/no-misused-promises': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/oauth-providers/mocks.ts', 'packages/zod-validator/src/v4.test.ts'],
    rules: {
      'typescript/no-deprecated': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/oauth-providers/src/index.test.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-argument': 'off',
    },
  },
  {
    files: [
      'packages/oauth-providers/src/providers/discord/discordAuth.ts',
      'packages/oauth-providers/src/providers/facebook/facebookAuth.ts',
      'packages/oauth-providers/src/providers/github/githubAuth.ts',
      'packages/oauth-providers/src/providers/google/googleAuth.ts',
      'packages/oauth-providers/src/providers/linkedin/linkedinAuth.ts',
      'packages/oauth-providers/src/providers/msentra/msentraAuth.ts',
      'packages/oauth-providers/src/providers/twitch/twitchAuth.ts',
      'packages/oauth-providers/src/providers/x/xAuth.ts',
    ],
    rules: {
      'typescript/no-unsafe-member-access': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/oauth-providers/src/providers/msentra/authFlow.ts'],
    rules: {
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/oauth-providers/src/utils/objectToQuery.ts'],
    rules: {
      'typescript/no-dynamic-delete': 'off',
    },
  },
  {
    files: ['packages/oidc-auth/src/index.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/otel/src/index.test.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/prometheus/src/index.ts'],
    rules: {
      'typescript/no-deprecated': 'off',
    },
  },
  {
    files: ['packages/qwik-city/src/index.ts'],
    rules: {
      'typescript/no-floating-promises': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/react-renderer/src/react-renderer.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/sentry/src/index.test.ts'],
    rules: {
      'typescript/no-misused-promises': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: ['packages/sentry/src/index.ts'],
    rules: {
      'typescript/no-misused-promises': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/session/examples/cloudflare-kv.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/session/examples/unstorage.ts'],
    rules: {
      'typescript/no-floating-promises': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/ssg-plugins-essential/src/plugins/robots-txt.test.ts'],
    rules: {
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: [
      'packages/ssg-plugins-essential/src/plugins/rss.test.ts',
      'packages/ssg-plugins-essential/src/plugins/sitemaps.test.ts',
    ],
    rules: {
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: [
      'packages/ssg-plugins-essential/src/plugins/rss.ts',
      'packages/swagger-ui/src/index.ts',
    ],
    rules: {
      'typescript/no-base-to-string': 'off',
      'typescript/require-await': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/standard-validator/src/sanitize-issues.ts'],
    rules: {
      'typescript/no-dynamic-delete': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/stytch-auth/src/index.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/swagger-editor/src/index.ts'],
    rules: {
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/swagger-ui/src/index.test.ts'],
    rules: {
      'typescript/no-unnecessary-type-conversion': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/swagger-ui/src/swagger/renderer.ts'],
    rules: {
      'typescript/no-base-to-string': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/trpc-server/src/index.ts'],
    rules: {
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/unbound-method': 'off',
    },
  },
  {
    files: ['packages/tsyringe/src/index.test.ts'],
    rules: {
      'typescript/no-unsafe-argument': 'off',
    },
  },
  {
    files: [
      'packages/typebox-validator/src/index.ts',
      'packages/typedriver-validator/src/index.ts',
    ],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/typia-validator/src/http.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/unified-signatures': 'off',
    },
  },
  {
    files: ['packages/typia-validator/src/index.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/ua-blocker/src/ai-bots.test.ts'],
    rules: {
      'typescript/await-thenable': 'off',
    },
  },
  {
    files: ['packages/zod-openapi/src/index.test-d.ts'],
    rules: {
      'typescript/no-floating-promises': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/zod-openapi/src/index.test.ts'],
    rules: {
      'typescript/no-deprecated': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/require-await': 'off',
    },
  },
  {
    files: ['packages/zod-openapi/src/index.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-non-null-assertion': 'off',
      'typescript/no-unnecessary-type-parameters': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/zod-validator/src/index.ts'],
    rules: {
      'typescript/no-invalid-void-type': 'off',
      'typescript/no-unnecessary-type-parameters': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/typebox-validator/src/index.ts'],
    rules: {
      'typescript/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/typedriver-validator/src/index.ts'],
    rules: {
      'typescript/no-unsafe-return': 'off',
    },
  },
]
