# Hello middleware for Hono

An example project of the third-party middleware for [Hono](https://github.com/honojs/hono).
This middleware add `X-Message` header to the Response.

## Usage

```ts
import { hello } from '@honojs/hello'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', hello('Hello!! Hono!!'))
app.get('/', (c) => c.text('foo'))

export default app
```

## Deno

```ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { hello } from 'https://deno.land/x/hono_hello/mod.ts'
import { Hono } from 'https://deno.land/x/hono/mod.ts'

const app = new Hono()

app.use('*', hello('Hello!! Hono!!'))
app.get('/', (c) => c.text('foo'))

serve(app.fetch)
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
