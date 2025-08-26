# @hono/oauth-providers

## 0.8.5

### Patch Changes

- [#1404](https://github.com/honojs/middleware/pull/1404) [`fce74aeda2958faa4d0ed17dfcfe7cbbb74287fa`](https://github.com/honojs/middleware/commit/fce74aeda2958faa4d0ed17dfcfe7cbbb74287fa) Thanks [@sushichan044](https://github.com/sushichan044)! - fix: enable CSRF protection for MSEntra ID authentication

  Fixed a bug where the state parameter was not being passed to the MSEntra AuthFlow constructor. As a result, CSRF protection now properly works for MSEntra ID authentication, ensuring that authentication requests are protected against Cross-Site Request Forgery attacks.

## 0.8.4

### Patch Changes

- [#1372](https://github.com/honojs/middleware/pull/1372) [`1980a66370d4afc8d552ac08bd25af0c87b49112`](https://github.com/honojs/middleware/commit/1980a66370d4afc8d552ac08bd25af0c87b49112) Thanks [@mrdear](https://github.com/mrdear)! - fixed github email request content-type

## 0.8.3

### Patch Changes

- [#1364](https://github.com/honojs/middleware/pull/1364) [`ba19e66f6d086089e15b04bc866c7ebf9cd43409`](https://github.com/honojs/middleware/commit/ba19e66f6d086089e15b04bc866c7ebf9cd43409) Thanks [@rxliuli](https://github.com/rxliuli)! - handle refersh_token on googleAuth

## 0.8.2

### Patch Changes

- [#1254](https://github.com/honojs/middleware/pull/1254) [`e1e8a6626d4a739f40ec1ac97c1671322522bee6`](https://github.com/honojs/middleware/commit/e1e8a6626d4a739f40ec1ac97c1671322522bee6) Thanks [@BarryThePenguin](https://github.com/BarryThePenguin)! - Update package repository

## 0.8.1

### Patch Changes

- [#1201](https://github.com/honojs/middleware/pull/1201) [`641fd4c3de6d3248f131a09748f55a9007d7f77c`](https://github.com/honojs/middleware/commit/641fd4c3de6d3248f131a09748f55a9007d7f77c) Thanks [@BarryThePenguin](https://github.com/BarryThePenguin)! - Add explicit return types

## 0.8.0

### Minor Changes

- [#1163](https://github.com/honojs/middleware/pull/1163) [`cf48336cbd123a45b461caaa41325d2302182901`](https://github.com/honojs/middleware/commit/cf48336cbd123a45b461caaa41325d2302182901) Thanks [@BarryThePenguin](https://github.com/BarryThePenguin)! - The PR adds Microsoft Entra (AzureAD) to the list of supported 3rd-party OAuth providers.

## 0.7.1

### Patch Changes

- [#1099](https://github.com/honojs/middleware/pull/1099) [`091b182a6ac1b7bb1129123d3cd0acca5e41b80d`](https://github.com/honojs/middleware/commit/091b182a6ac1b7bb1129123d3cd0acca5e41b80d) Thanks [@liquidleif](https://github.com/liquidleif)! - fix: Update twitter authorization url

## 0.7.0

### Minor Changes

- [#981](https://github.com/honojs/middleware/pull/981) [`e5f383787c2bd47657f67a99074515eab969963b`](https://github.com/honojs/middleware/commit/e5f383787c2bd47657f67a99074515eab969963b) Thanks [@Younis-Ahmed](https://github.com/Younis-Ahmed)! - These chages introduces a Twitch OAuth provider, expanding the middleware's OAuth offerings. It includes a new middleware for Twitch authentication, a dedicated `AuthFlow` class, token refreshing/revocation/validation, and comprehensive type definitions. Detailed tests ensure correct behavior and error handling.

  - **Twitch OAuth Middleware `src/providers/twitch/twitchAuth.ts`:** Implements the core authentication flow, handling state management, redirects, and context variable setting (`token`, `refresh-token`, `user-twitch`, `granted-scopes`).

  - **AuthFlow Class `src/providers/twitch/authFlow.ts`:** Encapsulates token exchange and user data retrieval, with robust error handling.

  - **Token Operations `src/providers/twitch/refreshToken.ts`:** Provides functions for refreshing and revoking tokens.

  - **Type Definitions `src/providers/twitch/types.ts:** Defines comprehensive types for Twitch API responses.

  - **Extensive Testing (`test/handlers.ts`, `test/index.test.ts`):** Includes unit tests covering redirection, valid code flow, error handling, refresh/revoke token, custom and built-in state scenarios, using a mock server.

  - **Validate Token `src/providers/twitch/validateToken`**: That hit `/validate` endpoint to verify that the access token is still valid for reasons other than token expiring.

## 0.6.2

### Patch Changes

- [#662](https://github.com/honojs/middleware/pull/662) [`40e3a780d1c817abab48177a49fb8040eda4633d`](https://github.com/honojs/middleware/commit/40e3a780d1c817abab48177a49fb8040eda4633d) Thanks [@nakasyou](https://github.com/nakasyou)! - support hono v4.5

## 0.6.1

### Patch Changes

- [#697](https://github.com/honojs/middleware/pull/697) [`c3b67a6c3b493482833f5b030596906286da62b8`](https://github.com/honojs/middleware/commit/c3b67a6c3b493482833f5b030596906286da62b8) Thanks [@taishinaritomi](https://github.com/taishinaritomi)! - fix(@hono/oauth-providers): google provider attach custom parameters

## 0.6.0

### Minor Changes

- [#601](https://github.com/honojs/middleware/pull/601) [`e54c62875161c0d2b7e21c0d9108d311e23072a8`](https://github.com/honojs/middleware/commit/e54c62875161c0d2b7e21c0d9108d311e23072a8) Thanks [@jokester](https://github.com/jokester)! - allow override of redirect_uri

## 0.5.1

### Patch Changes

- [#588](https://github.com/honojs/middleware/pull/588) [`69eca66e4de153fa46a6298314a1688fd4efbe4c`](https://github.com/honojs/middleware/commit/69eca66e4de153fa46a6298314a1688fd4efbe4c) Thanks [@jokester](https://github.com/jokester)! - load env.SECRET with hono/adapter, to support non-worker

## 0.5.0

### Minor Changes

- [#505](https://github.com/honojs/middleware/pull/505) [`42e75f07dc4eef9a1cd3d88062fc90edd6677aeb`](https://github.com/honojs/middleware/commit/42e75f07dc4eef9a1cd3d88062fc90edd6677aeb) Thanks [@monoald](https://github.com/monoald)! - Requesting github for user email with token

## 0.4.0

### Minor Changes

- [#454](https://github.com/honojs/middleware/pull/454) [`65418948ab4e977102dabe6373246890a337e5e9`](https://github.com/honojs/middleware/commit/65418948ab4e977102dabe6373246890a337e5e9) Thanks [@aaronware](https://github.com/aaronware)! - Allow for an optional state arg to be passed to Google Auth middleware

## 0.3.2

### Patch Changes

- [#421](https://github.com/honojs/middleware/pull/421) [`cef4be898a31854870c333433b1f64d7d6c44c73`](https://github.com/honojs/middleware/commit/cef4be898a31854870c333433b1f64d7d6c44c73) Thanks [@monoald](https://github.com/monoald)! - Github App user email problem

## 0.3.1

### Patch Changes

- [#396](https://github.com/honojs/middleware/pull/396) [`98cffb0ae9c069e8f08433016e3908fa715c76b7`](https://github.com/honojs/middleware/commit/98cffb0ae9c069e8f08433016e3908fa715c76b7) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: update `peerDependencies`

## 0.3.0

### Minor Changes

- [#342](https://github.com/honojs/middleware/pull/342) [`8841b6427d23046e069e8ec6010d6624ed8e68e4`](https://github.com/honojs/middleware/commit/8841b6427d23046e069e8ec6010d6624ed8e68e4) Thanks [@monoald](https://github.com/monoald)! - Add Discord provider

## 0.2.0

### Minor Changes

- [#283](https://github.com/honojs/middleware/pull/283) [`aa9527b`](https://github.com/honojs/middleware/commit/aa9527b9e7291095f08f0e9df204b0eb6ba1a0db) Thanks [@monoald](https://github.com/monoald)! - Add X (Twitter) provider

## 0.1.2

### Patch Changes

- [#279](https://github.com/honojs/middleware/pull/279) [`cfaa80a`](https://github.com/honojs/middleware/commit/cfaa80a9e723c4af6e30eb796321db5184a7a6d5) Thanks [@rawkode](https://github.com/rawkode)! - ensure CSRF state returned to GitHub apps

- [#280](https://github.com/honojs/middleware/pull/280) [`14443cc`](https://github.com/honojs/middleware/commit/14443cc255735cc25b85f18f83b1fb3b53583de6) Thanks [@rawkode](https://github.com/rawkode)! - ensure redirect to original URL for GitHub apps

## 0.1.1

### Patch Changes

- [#276](https://github.com/honojs/middleware/pull/276) [`d8eebd7`](https://github.com/honojs/middleware/commit/d8eebd7822f34b49dcb83fb5746df3cb24737260) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: include files correctly

## 0.1.0

### Minor Changes

- [#262](https://github.com/honojs/middleware/pull/262) [`d2696c4`](https://github.com/honojs/middleware/commit/d2696c46ba529dade19a27e4be1fb38fdbf247ab) Thanks [@monoald](https://github.com/monoald)! - Add oauth-providers middleware
