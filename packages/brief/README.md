# Brief middleware for Hono

The brief middleware for `Hono`. It logs the unique routes of the application during startup. When used, it prints the registered routes and their associated HTTP methods, excluding routes with the "ALL" method. This helps quickly verify available routes and their configuration, facilitating debugging and API documentation.

## Usage

```ts
import { brief } from '@hono/brief'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', brief(app))
app.get('/', (c) => c.text('foo'))

export default app
```

With custom title:

```ts
import { brief } from '@hono/brief'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', brief(app, 'CUSTOM TITLE'))
app.get('/', (c) => c.text('foo'))

export default app
```

## Author

pietrodev07 <https://github.com/pietrodev07>

## License

MIT
