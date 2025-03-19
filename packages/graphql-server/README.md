# GraphQL Server Middleware

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=graphql-server)](https://codecov.io/github/honojs/middleware)

## Requirements

This middleware depends on [GraphQL.js](https://www.npmjs.com/package/graphql).

```sh
npm i @hono/graphql-server
```

or

```plain
yarn add @hono/graphql-server
```

## Usage

index.ts:

```ts
import { Hono } from 'hono'
import { type RootResolver, graphqlServer } from '@hono/graphql-server'
import { buildSchema } from 'graphql'

export const app = new Hono()

const schema = buildSchema(`
type Query {
  hello: String
}
`)

const rootResolver: RootResolver = (c) => {
  return {
    hello: () => 'Hello Hono!',
  }
}

app.use(
  '/graphql',
  graphqlServer({
    schema,
    rootResolver,
    graphiql: true, // if `true`, presents GraphiQL when the GraphQL endpoint is loaded in a browser.
  })
)

app.fire()
```

## Author

Minghe Huang <h.minghe@gmail.com>
