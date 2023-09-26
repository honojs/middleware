# Swagger UI Middleware for Hono

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

// Define your OpenAPI spec
const openApiSpec = {
  openapi: '3.0.3',
  info: { version: '1.0.0', title: 'Sample API' },
  servers: [{ url: '/api' }],
  // ... other OpenAPI spec properties
}

// Use the middleware to serve Swagger UI at /swagger-ui
app.use('/swagger-ui', swaggerUI({ spec: openApiSpec }))

export default app
```

### Component Usage

If you are using `hono/jsx`, you can use the `SwaggerUI` component to render Swagger UI within your JSX/TSX components. Here's an example:

```ts
import { SwaggerUI } from '@hono/swagger-ui'

// In your component
const MyComponent = () => {
  return (
    <SwaggerUI
      url='/api/doc'
      title='API Documentation'
      css='body { background-color: #f9f9f9; }'
      js="console.log('Swagger UI Loaded');"
      cssUrls={['https://cdn.jsdelivr.net/npm/destyle.css@1.0.15/destyle.css']}
      jsUrls={['https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js']}
    />
  )
}
```

In this example, the `SwaggerUI` component is used to render Swagger UI with a custom title, CSS, JavaScript, and a specific Swagger UI version.

## Options

Both the middleware and the component accept an options object for customization. Here are the available options:

- `url` (string): The URL to the OpenAPI specification.
- `spec` (object): The OpenAPI specification object.
- `title` (string, optional): The title for the Swagger UI page.
- `css` (string, optional): A CSS string to be injected into the page.
- `js` (string, optional): A JavaScript string to be injected into the page.
- `cssUrls` (string[], optional): An array of URLs to external CSS files.
- `jsUrls` (string[], optional): An array of URLs to external JavaScript files.
- `ui` (object, optional): An object with additional Swagger UI configuration options.
  - `version` (string, optional): The version of Swagger UI to use.

## Author

naporitan <https://github.com/naporin0624>

## License

MIT
