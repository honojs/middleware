# Qwik City middleware for Hono

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
