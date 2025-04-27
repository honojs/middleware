# Hello middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=hello)](https://codecov.io/github/honojs/middleware)

An example project of the third-party middleware for [Hono](https://github.com/honojs/hono).
This middleware add `X-Message` header to the Response.

## Usage

```ts
import { hello } from '@hono/hello'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', hello('Hello!! Hono!!'))
app.get('/', (c) => c.text('foo'))

export default app
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
