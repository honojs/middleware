# CBOR helper for Hono

This package is a CBOR helper for Hono.

## Usage

```ts
import { Hono } from 'hono'
import { parseCborFromHonoRequest, renderCborWithContext } from '@hono/cbor'

const app = new Hono()

// Render CBOR as `Content-Type: application/cbor`.
app.get('/', async (c) => {
  return renderCborWithContext(c, { message: 'Hello CBOR!' })
})

// Parse the request body of type `application/cbor`.
app.post('/', async (c) => {
  const body = await parseCborFromHonoRequest(c.req)
  // ...
})
```

## Author

3w36zj6 <https://github.com/3w36zj6>

## License

MIT
