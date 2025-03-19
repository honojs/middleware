# Bun Transpiler middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=bun-transpiler)](https://codecov.io/github/honojs/middleware)

The Bun Transpiler middleware is a Hono middleware designed to transpile content such as TypeScript or TSX. You can place your script written in TypeScript in a directory and serve it using `serveStatic`. When you apply this middleware, your script will automatically be served transpiled into JavaScript code.

This middleware works only with [Bun](https://bun.sh/).

## Usage

### Installation

```sh
npm i @hono/bun-transpiler
```

### Example

```ts
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { bunTranspiler } from '@hono/bun-transpiler'

const app = new Hono()

app.get('/static/:scriptName{.+.tsx?}', bunTranspiler())
app.get('/static/*', serveStatic({ root: './' }))

export default app
```

## Notes

- This middleware does not have a cache feature. If you want to cache the transpiled code, use [Cache Middleware](https://hono.dev/middleware/builtin/cache) or your own custom middleware.

## Author

Florian Kapaun <https://github.com/floriankapaun>

Heavily inspired by [esbuild-transpiler](https://github.com/honojs/middleware/tree/main/packages/esbuild-transpiler) by [Andres C. Rodriguez](https://github.com/acrodrig) and [Yusuke Wada](https://github.com/yusukebe).

## License

MIT
