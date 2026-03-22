# Bun Compress Middleware for Hono

> **Deprecated**: Bun now supports the [CompressionStream API](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) natively (since [oven-sh/bun#1723](https://github.com/oven-sh/bun/issues/1723) was resolved). Use the built-in [`hono/compress`](https://hono.dev/docs/middleware/builtin/compress) middleware instead.

This middleware was created as a workaround for Bun's missing `CompressionStream` support. Now that Bun has added native support, `hono/compress` works on Bun without any polyfill.

## Migration

Replace:

```ts
import { compress } from '@hono/bun-compress'
```

With:

```ts
import { compress } from 'hono/compress'
```

No other changes needed — the API is the same.
