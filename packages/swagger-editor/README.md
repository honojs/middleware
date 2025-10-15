# Swagger Editor Middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=swagger-editor)](https://codecov.io/github/honojs/middleware)

This library, `@hono/swagger-editor` is the middleware for integrating Swagger Editor with Hono applications. The Swagger Editor is an open source editor to design, define and document RESTful APIs in the Swagger Specification.

## Installation

```bash
npm install @hono/swagger-editor
# or
yarn add @hono/swagger-editor
```

## Usage

You can use the `swaggerEditor` middleware to serve Swagger Editor on a specific route in your Hono application. Here's how you can do it:

```ts
import { Hono } from 'hono'
import { swaggerUI } from '@hono/swagger-ui'

const app = new Hono()

// Use the middleware to serve Swagger Editor at /swagger-editor
app.get('/swagger-editor', swaggerEditor({ url: '/doc' }))

export default app
```

## Options

Middleware supports almost all swagger-editor options. See full documentation: <https://swagger.io/docs/open-source-tools/swagger-editor/>

## Authors

- Ogabek Yuldoshev <https://github.com/OgabekYuldoshev>

## License

MIT
