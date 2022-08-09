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

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
