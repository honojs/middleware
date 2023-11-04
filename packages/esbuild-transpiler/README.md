# esbuild Transpiler Middleware

The **esbuild Transpiler Middleware** is a Hono Middleware designed to transpile content such as TypeScript or TSX.
You can place your script written in TypeScript in a directory and serve it using `serveStatic`.
When you apply this Middleware, the script will be transpiled into JavaScript code.

This Middleware uses esbuild. It works on _Cloudflare Workers, Deno, Deno Deploy, or Node.js_.

## Usage

Usage differs depending on the platform.

### Cloudflare Workers / Pages

#### Installation

```text
npm i hono @hono/esbuild-transpiler esbuild-wasm
```

#### Example

```ts
import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { esbuildTranspiler } from '@hono/esbuild-transpiler/wasm'
// Specify the path of the esbuild wasm file.
import wasm from '../node_modules/esbuild-wasm/esbuild.wasm'

const app = new Hono()

app.get('/static/:scriptName{.+.tsx?}', esbuildTranspiler({ wasmModule: wasm }))
app.get('/static/*', serveStatic({ root: './' }))

export default app
```

`global.d.ts`:

```ts
declare module '*.wasm'
```

### Deno / Deno Deploy

#### Example

```ts
import { Hono } from 'npm:hono'

import { serveStatic } from 'npm:hono/deno'
import { esbuildTranspiler } from 'npm:@hono/esbuild-transpiler'
import * as esbuild from 'https://deno.land/x/esbuild@v0.19.5/wasm.js'

const app = new Hono()

await esbuild.initialize({
  wasmURL: 'https://deno.land/x/esbuild@v0.19.5/esbuild.wasm',
  worker: false,
})

app.get('/static/*', esbuildTranspiler({ esbuild }))
app.get('/static/*', serveStatic())

Deno.serve(app.fetch)
```

### Node.js

#### Installation

```text
npm i hono @hono/node-server @hono/esbuild-transpiler esbuild
```

#### Example

```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { esbuildTranspiler } from '@hono/esbuild-transpiler/node'

const app = new Hono()

app.get('/static/:scriptName{.+.tsx?}', esbuildTranspiler())
app.get('/static/*', serveStatic({ root: './' }))

serve(app)
```

## Notes

- This middleware does not have a cache feature. If you want to cache the transpiled code, use [Cache Middleware](https://hono.dev/middleware/builtin/cache) or your own custom middleware.

## Authors

- Yusuke Wada <https://github.com/yusukebe>
- Andres C. Rodriguez <https://github.com/acrodrig>

Original idea and implementation for "_Typescript Transpiler Middleware_" is by Andres C. Rodriguez.

## License

MIT
