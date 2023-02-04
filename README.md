# GraphQL Server Middleware

## Information

GraphQL Server Middleware `@honojs/graphql-server` is renamed to `@hono/graphql-server`.
`@honojs/graphql-server` is not maintained, please use `@hono/graphql-server`.
Also, for Deno, you can use import with `npm:` prefix like `npm:@hono/graphql-server`.

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

index.js:

```js
import { Hono } from 'hono'
import { graphqlServer } from '@hono/graphql-server'
import { buildSchema } from 'graphql'

export const app = new Hono()

const schema = buildSchema(`
type Query {
  hello: String
}
`)

const rootResolver = (ctx) => {
  return {
    hello: () => 'Hello Hono!',
  }
}

app.use(
  '/graphql',
  graphqlServer({
    schema,
    rootResolver,
  })
)

app.fire()
```
