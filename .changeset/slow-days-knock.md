---
'@hono/oauth-providers': minor
---

These chages introduces a Twitch OAuth provider, expanding the middleware's OAuth offerings. It includes a new middleware for Twitch authentication, a dedicated `AuthFlow` class, token refreshing/revocation/validation, and comprehensive type definitions. Detailed tests ensure correct behavior and error handling.

- **Twitch OAuth Middleware `src/providers/twitch/twitchAuth.ts`:** Implements the core authentication flow, handling state management, redirects, and context variable setting (`token`, `refresh-token`, `user-twitch`, `granted-scopes`).

- **AuthFlow Class `src/providers/twitch/authFlow.ts`:** Encapsulates token exchange and user data retrieval, with robust error handling.

- **Token Operations `src/providers/twitch/refreshToken.ts`:** Provides functions for refreshing and revoking tokens.

- **Type Definitions `src/providers/twitch/types.ts:** Defines comprehensive types for Twitch API responses.

- **Extensive Testing (`test/handlers.ts`, `test/index.test.ts`):** Includes unit tests covering redirection, valid code flow, error handling, refresh/revoke token, custom and built-in state scenarios, using a mock server.

- **Validate Token `src/providers/twitch/validateToken`**: That hit `/validate` endpoint to verify that the access token is still valid for reasons other than token expiring.
