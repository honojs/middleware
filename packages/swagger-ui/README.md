# Swagger UI Middleware and Component for Hono

This library, `@hono/swagger-ui`, provides a middleware and a component for integrating Swagger UI with Hono applications. Swagger UI is an interactive documentation interface for RESTful APIs, making it easier to understand and test API endpoints.

## Installation

```bash
npm install @hono/swagger-ui
# or
yarn add @hono/swagger-ui
```

## Usage

### Middleware Usage

You can use the `swaggerUI` middleware to serve Swagger UI on a specific route in your Hono application. Here's how you can do it:

```ts
import { Hono } from 'hono'
import { swaggerUI } from '@hono/swagger-ui'

const app = new Hono()

// Use the middleware to serve Swagger UI at /ui
app.get('/ui', swaggerUI({ url: '/doc' }))

export default app
```

### Component Usage

If you are using `hono/utils/html`, you can use the `SwaggerUI` component to render Swagger UI within your custom HTML structure. Here's an example:

```ts
import { Hono } from 'hono'
import { html } from 'hono/html'
import { SwaggerUI } from '@hono/swagger-ui'

const app = new Hono()

app.get('/ui', (c) => {
  return c.html(html`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Custom Swagger" />
        <title>Custom Swagger</title>
        <script>
          // custom script
        </script>
        <style>
          /* custom style */
        </style>
      </head>
      ${SwaggerUI({ url: '/doc' })}
    </html>
  `)
})

export default app
```

In this example, the `SwaggerUI` component is used to render Swagger UI within a custom HTML structure, allowing for additional customization such as adding custom scripts and styles.

## Options

Both the middleware and the component accept an options object for customization. Here are the available options:

- `url` (string): The URL to the OpenAPI specification.
- `ui` (object, optional): An object with additional Swagger UI configuration options.
  - `version` (string, optional): The version of Swagger UI to use.

## Author

naporitan <https://github.com/naporin0624>

## License

MIT
