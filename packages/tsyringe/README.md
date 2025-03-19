# tsyringe middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=tsyringe)](https://codecov.io/github/honojs/middleware)

The [tsyringe](https://github.com/microsoft/tsyringe) middleware provides a way to use dependency injection in [Hono](https://hono.dev/).

## Usage

```ts
import 'reflect-metadata' // tsyringe requires reflect-metadata or polyfill
import { container, inject, injectable } from 'tsyringe'
import { tsyringe } from '@hono/tsyringe'
import { Hono } from 'hono'

@injectable()
class Hello {
  constructor(@inject('name') private name: string) {}

  greet() {
    return `Hello, ${this.name}!`
  }
}

const app = new Hono()

app.use(
  '*',
  tsyringe((container) => {
    container.register('name', { useValue: 'world' })
  })
)

app.get('/', (c) => {
  const hello = container.resolve(Hello)
  return c.text(hello.greet())
})

export default app
```

### With providers

```ts
const app = new Hono()

app.use('/tenant/:name/*', async (c, next) => {
  await tsyringe((container) => {
    // Allowing to inject `c.var` or `c.req.param` in the providers
    const tenantName = c.req.param('name')

    container.register(Config, { useFactory: () => new Config(tenantName) })
  })(c, next)
})
```

## Author

Aotokitsuruya <https://github.com/elct9620>

## License

MIT
