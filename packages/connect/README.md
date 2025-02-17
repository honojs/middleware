# Connect middleware for Hono

An middleware for compatibility with express/connect for Hono

## Usage

```ts
import { connect } from '@hono/connect'
import { Hono } from 'hono'
import helmet from 'helmet'

const app = new Hono()

app.use('*', connect(helmet()))
app.get('/', (c) => c.text('foo'))

export default app
```

## Author

EdamAme-x <https://github.com/EdamAme-x>

## License

MIT
