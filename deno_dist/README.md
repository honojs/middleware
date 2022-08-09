# Sentry middleware for Hono

Sentry middleware for [Hono](https://github.com/honojs/hono).
This middleware sends captured exceptions to the Sentry data source named by the `SENTRY_DSN` environment variable via [toucan-js](https://github.com/robertcepa/toucan-js).

## Usage

```ts
import { sentry } from '@honojs/sentry'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', sentry())
app.get('/', (c) => c.text('foo'))

export default app
```

## Deno

```ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { sentry } from 'https://deno.land/x/hono_sentry/mod.ts'
import { Hono } from 'https://deno.land/x/hono/mod.ts'

const app = new Hono()

app.use('*', sentry())
app.get('/', (c) => c.text('foo'))

serve(app.fetch)
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
