---
'@hono/shopify-auth': minor
---

Add `@hono/shopify-auth`, a zero-dependency middleware for authenticating Shopify embedded app requests and webhooks.

- `shopifySessionToken` verifies an App Bridge session token and establishes the calling shop, with no storage and no network calls.
- `shopifyAccessToken` additionally guarantees a usable Admin API offline access token, via the token exchange grant with refresh-token rotation, persisted through a pluggable `ShopifySessionStorage`.
- `shopifyWebhook` verifies webhook HMAC signatures over the raw request body, and validates the unsigned `X-Shopify-Shop-Domain` as a `myshopify.com` host before it reaches an Admin API URL.
- Built entirely on Web Crypto and `fetch`, so it runs on Workers, Deno, Bun, and Node without change.
