# Bun Compress Middleware for Hono

Bun does not currently support the [CompressionStream API](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) so this middleware replicates the behavior of [`hono/compress`](https://hono.dev/docs/middleware/builtin/compress) using the Zlib library. This middleware will be deprecated once [Bun adds support for `CompressionStream`](https://github.com/oven-sh/bun/issues/1723).

This middleware will use `hono/compress` if CompressionStream is available so you can use this middleware in Bun and Node.js without any changes.

## Import

```ts
import { Hono } from 'hono'
import { compress } from '@hono/bun-compress'
```

## Usage

```ts
const app = new Hono()

app.use(compress())
```

## Options

### <Badge type="info" text="optional" /> encoding: `'gzip'` | `'deflate'`

The compression scheme to allow for response compression. Either `gzip` or `deflate`. If not defined, both are allowed and will be used based on the `Accept-Encoding` header. `gzip` is prioritized if this option is not provided and the client provides both in the `Accept-Encoding` header.

### <Badge type="info" text="optional" /> threshold: `number`

The minimum size in bytes to compress. Defaults to 1024 bytes.
