# Sentry Middleware for Hono

This middleware integrates [Hono](https://github.com/honojs/hono) with Sentry. It captures exceptions and sends them to the specified Sentry data source name (DSN) using [toucan-js](https://github.com/robertcepa/toucan-js).

## Installation

```plain
npm i hono @hono/sentry
```

## Configuration

If you're running your application on Cloudflare Workers, set a binding value named `SENTRY_DSN`, which will be used as the DSN. For instance, during development, you can specify this in `.dev.vars`:

```plain
SENTRY_DSN=<Your DSN>
```

On other platforms, you can directly provide the DSN by passing it as an option:

```ts
sentry({
  dsn: `<Your DSN>`,
})
```

## How to Use

```ts
import { Hono } from 'hono'
import { sentry } from '@hono/sentry'

const app = new Hono()

app.use('*', sentry())
app.get('/', (c) => c.text('foo'))

export default app
```

Options:

```ts
import type { Options as ToucanOptions } from 'toucan-js'
type Options = Omit<ToucanOptions, 'request' | 'context'>
```

### For Deno Users

```ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { sentry } from 'npm:@hono/sentry'
import { Hono } from 'https://deno.land/x/hono/mod.ts'

const app = new Hono()

app.use('*', sentry({ dsn: 'https://xxxxxx@xxx.ingest.sentry.io/xxxxxx' }))
app.get('/', (c) => c.text('foo'))

serve(app.fetch)
```

## Authors

- Samuel Lippert - <https://github.com/sam-lippert>
- Yusuke Wada - <https://github.com/yusukebe>

## License

MIT
