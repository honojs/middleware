# Router using @medley/router

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
