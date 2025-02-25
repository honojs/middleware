# ReDoc Middleware and Component for Hono

This library, `@hono/redoc`, provides a middleware and a component for integrating ReDoc with Hono applications. ReDoc is an interactive documentation interface for APIs compliant with the OpenAPI Specification, making it easier to understand and test API endpoints.

## Installation

```bash
npm install @hono/redoc
# or
yarn add @hono/redoc
```

## Usage

### Middleware Usage

You can use the `redoc` middleware to serve ReDoc on a specific route in your Hono application. Here's how you can do it:

```ts
import { Hono } from 'hono'
import { redoc } from '@hono/redoc'

const app = new Hono()

// Use the middleware to serve ReDoc at /ui
app.get('/ui', redoc({ url: '/doc' }))

export default app
```

### Component Usage

If you are using `hono/html`, you can use the `ReDoc` component to render ReDoc within your custom HTML structure. Here's an example:

```ts
import { Hono } from 'hono'
import { html } from 'hono/html'
import { SwaggerUI } from '@hono/redoc'

const app = new Hono()

app.get('/ui', (c) => {
  return c.html(`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Custom Swagger" />
        <title>Custom ReDoc</title>
        <script>
          // custom script
        </script>
        <style>
          /* custom style */
        </style>
      </head>
      ${ReDoc({ url: '/doc' })}
    </html>
  `)
})
export default app
```

In this example, the `ReDoc` component is used to render ReDoc within a custom HTML structure, allowing for additional customization such as adding custom scripts and styles.

### With `OpenAPIHono` Usage

Hono's middleware has OpenAPI integration `@hono/zod-openapi`, so you can use it to create an OpenAPI document and serve it easily with ReDoc.

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/redoc'

const app = new OpenAPIHono()

app.openapi(
  createRoute({
    method: 'get',
    path: '/hello',
    responses: {
      200: {
        description: 'Respond a message',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string()
            })
          }
        }
      }
    }
  }),
  (c) => {
    return c.json({
      message: 'hello'
    })
  }
)

app.get(
  '/ui',
  redoc({
    url: '/doc'
  })
)

app.doc('/doc', {
  info: {
    title: 'An API',
    version: 'v1'
  },
  openapi: '3.1.0'
})

export default app
```

## Options

Both the middleware and the component accept an options object for customization.

The following options are available:

- `version` (string, optional): The version of ReDoc to use, defaults to `latest`.
- `manuallyReDocHtml` (string, optional): If you want to use your own custom HTML, you can specify it here. If this option is specified, the all options except `version` will be ignored.

and most of options from [ReDoc](
  https://redocly.com/docs-legacy/api-reference-docs/configuration/functionality
) are supported as well.

such as:
- `url` (string, optional): The URL pointing to the OpenAPI definition (v2 or v3) that describes the API.

## Authors

- jonghyo <https://github.com/jonghyo>

## License

MIT
