# Qwik City middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=qwik-city)](https://codecov.io/github/honojs/middleware)

**WIP**

## Usage

```ts
import { qwikMiddleware } from '@hono/qwik-city'
import qwikCityPlan from '@qwik-city-plan'
import render from './entry.ssr'
import { Hono } from 'hono'

const app = new Hono()

app.all('*', qwikMiddleware({ render, qwikCityPlan }))

export default app
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
