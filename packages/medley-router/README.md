# Router using @medley/router

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=medley-router)](https://codecov.io/github/honojs/middleware)

Just a PoC.

## Usage

```ts
import { Hono } from 'hono'
import { MedleyRouter } from '@hono/medley-router'

const app = new Hono({ router: new MedleyRouter() })

app.get('/', (c) => c.text('Hello'))
```

## Authors

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
