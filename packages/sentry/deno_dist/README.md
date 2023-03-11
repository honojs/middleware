# Sentry middleware for Hono

Sentry middleware for [Hono](https://github.com/honojs/hono).
This middleware sends captured exceptions to the specified Sentry data source name via [toucan-js](https://github.com/robertcepa/toucan-js).

## Usage

```ts
import { Hono } from 'hono'
import { sentry } from '@hono/sentry'

const app = new Hono()

app.use('*', sentry())
app.get('/', (c) => c.text('foo'))

export default app
```

## Deno

```ts
import { serve } from 'https://deno.land/std/http/server.ts'
import { sentry } from 'npm:@hono/sentry'
import { Hono } from 'https://deno.land/x/hono/mod.ts'

const app = new Hono()

app.use('*', sentry({ dsn: 'https://xxxxxx@xxx.ingest.sentry.io/xxxxxx' }))
app.get('/', (c) => c.text('foo'))

serve(app.fetch)
```

## Author

Samuel Lippert <https://github.com/sam-lippert>

## License

MIT
