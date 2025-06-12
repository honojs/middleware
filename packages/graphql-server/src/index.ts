import {
  Source,
  parse,
  execute,
  validateSchema,
  validate,
  specifiedRules,
  getOperationAST,
  GraphQLError,
} from 'graphql'

import type {
  GraphQLSchema,
  DocumentNode,
  ValidationRule,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from 'graphql'

import type { Context, Env, Input, MiddlewareHandler } from 'hono'
import { parseBody } from './parse-body'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RootResolver<E extends Env = any, P extends string = any, I extends Input = {}> = (
  // eslint-enable-next-line @typescript-eslint/no-explicit-any
  c: Context<E, P, I>
) => Promise<unknown> | unknown

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Options<E extends Env = any, P extends string = any, I extends Input = {}> = {
  // eslint-enable-next-line @typescript-eslint/no-explicit-any
  schema: GraphQLSchema
  rootResolver?: RootResolver<E, P, I>
  pretty?: boolean
  validationRules?: readonly ValidationRule[]
  graphiql?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const graphqlServer = <E extends Env = any, P extends string = any, I extends Input = {}>(
  // eslint-enable-next-line @typescript-eslint/no-explicit-any
  options: Options<E, P, I>
): MiddlewareHandler => {
  const schema = options.schema
  const pretty = options.pretty ?? false
  const validationRules = options.validationRules ?? []
  const showGraphiQL = options.graphiql ?? false

  return async (c: Context<E, P, I>) => {
    // GraphQL HTTP only supports GET and POST methods.
    if (c.req.method !== 'GET' && c.req.method !== 'POST') {
      return c.json(errorMessages(['GraphQL only supports GET and POST requests.']), 405, {
        Allow: 'GET, POST',
      })
    }

    let params: GraphQLParams
    try {
      params = await getGraphQLParams(c.req.raw)
    } catch (e) {
      if (e instanceof Error) {
        console.error(`${e.stack || e.message}`)
        return c.json(errorMessages([e.message], [e]), 400)
      }
      throw e
    }

    const { query, variables, operationName } = params

    if (query == null) {
      if (showGraphiQL && c.req.method === 'GET') {
        return respondWithGraphiQL(c)
      }
      return c.json(errorMessages(['Must provide query string.']), 400)
    }

    const schemaValidationErrors = validateSchema(schema)
    if (schemaValidationErrors.length > 0) {
      // Return 500: Internal Server Error if invalid schema.
      return c.json(
        errorMessages(['GraphQL schema validation error.'], schemaValidationErrors),
        500
      )
    }

    let documentAST: DocumentNode
    try {
      documentAST = parse(new Source(query, 'GraphQL request'))
    } catch (syntaxError: unknown) {
      // Return 400: Bad Request if any syntax errors errors exist.
      if (syntaxError instanceof Error) {
        console.error(`${syntaxError.stack || syntaxError.message}`)
        const e = new GraphQLError(syntaxError.message, {
          originalError: syntaxError,
        })
        return c.json(errorMessages(['GraphQL syntax error.'], [e]), 400)
      }
      throw syntaxError
    }

    // Validate AST, reporting any errors.
    const validationErrors = validate(schema, documentAST, [...specifiedRules, ...validationRules])

    if (validationErrors.length > 0) {
      // Return 400: Bad Request if any validation errors exist.
      return c.json(errorMessages(['GraphQL validation error.'], validationErrors), 400)
    }

    if (c.req.method === 'GET') {
      // Determine if this GET request will perform a non-query.
      const operationAST = getOperationAST(documentAST, operationName)
      if (operationAST && operationAST.operation !== 'query') {
        // Otherwise, report a 405: Method Not Allowed error.
        return c.json(
          errorMessages([
            `Can only perform a ${operationAST.operation} operation from a POST request.`,
          ]),
          405,
          { Allow: 'POST' }
        )
      }
    }

    let result: FormattedExecutionResult
    const { rootResolver } = options

    try {
      result = await execute({
        schema,
        document: documentAST,
        rootValue: rootResolver ? await rootResolver(c) : null,
        contextValue: c,
        variableValues: variables,
        operationName: operationName,
      })
    } catch (contextError: unknown) {
      if (contextError instanceof Error) {
        console.error(`${contextError.stack || contextError.message}`)
        const e = new GraphQLError(contextError.message, {
          originalError: contextError,
          nodes: documentAST,
        })
        // Return 400: Bad Request if any execution context errors exist.
        return c.json(errorMessages(['GraphQL execution context error.'], [e]), 400)
      }
      throw contextError
    }

    if (!result.data) {
      if (result.errors) {
        return c.json(errorMessages([result.errors.toString()], result.errors), 500)
      }
    }

    if (pretty) {
      const payload = JSON.stringify(result, null, pretty ? 2 : 0)
      return c.text(payload, 200, {
        'Content-Type': 'application/json',
      })
    } else {
      return c.json(result)
    }
  }
}

export interface GraphQLParams {
  query: string | null
  variables: { readonly [name: string]: unknown } | null
  operationName: string | null
  raw: boolean
}

export const getGraphQLParams = async (request: Request): Promise<GraphQLParams> => {
  const urlData = new URLSearchParams(request.url.split('?')[1])
  const bodyData = await parseBody(request)

  // GraphQL Query string.
  let query = urlData.get('query') ?? (bodyData.query as string | null)

  if (typeof query !== 'string') {
    query = null
  }

  // Parse the variables if needed.
  let variables = (urlData.get('variables') ?? bodyData.variables) as {
    readonly [name: string]: unknown
  } | null
  if (typeof variables === 'string') {
    try {
      variables = JSON.parse(variables)
    } catch {
      throw Error('Variables are invalid JSON.')
    }
  } else if (typeof variables !== 'object') {
    variables = null
  }

  // Name of GraphQL operation to execute.
  let operationName = urlData.get('operationName') ?? (bodyData.operationName as string | null)
  if (typeof operationName !== 'string') {
    operationName = null
  }

  const raw = urlData.get('raw') != null || bodyData.raw !== undefined

  const params: GraphQLParams = {
    query: query,
    variables: variables,
    operationName: operationName,
    raw: raw,
  }

  return params
}

export const errorMessages = (
  messages: string[],
  graphqlErrors?: readonly GraphQLError[] | readonly GraphQLFormattedError[]
): {
  errors: readonly GraphQLError[] | readonly GraphQLFormattedError[]
} => {
  if (graphqlErrors) {
    return {
      errors: graphqlErrors,
    }
  }

  return {
    errors: messages.map((message) => {
      return {
        message: message,
      }
    }),
  }
}

export const respondWithGraphiQL = (c: Context): Response => {
  // https://github.com/graphql/graphiql/blob/03171d5614c61fb345763636d120da2b536d54a0/examples/graphiql-cdn/index.html
  return c.html(`<!--
 *  Copyright (c) 2021 GraphQL Contributors
 *  All rights reserved.
 *
 *  This source code is licensed under the license found in the
 *  LICENSE file in the root directory of this source tree.
-->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GraphiQL</title>
    <style>
      body {
        margin: 0;
        overflow: hidden; /* in Firefox */
      }

      #graphiql {
        height: 100dvh;
      }

      .loading {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 4rem;
      }
    </style>
    <link
      rel="stylesheet"
      href="https://esm.sh/graphiql@4.0.0/dist/style.css"
    />
    <link
      rel="stylesheet"
      href="https://esm.sh/@graphiql/plugin-explorer@4.0.0/dist/style.css"
    />
    <!-- Note: the ?standalone flag bundles the module along with all of its \`dependencies\`, excluding \`peerDependencies\`, into a single JavaScript file. -->
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.1.0",
          "react/jsx-runtime": "https://esm.sh/react@19.1.0/jsx-runtime",

          "react-dom": "https://esm.sh/react-dom@19.1.0",
          "react-dom/client": "https://esm.sh/react-dom@19.1.0/client",

          "graphiql": "https://esm.sh/graphiql@4.0.0?standalone&external=react,react/jsx-runtime,react-dom,@graphiql/react",
          "@graphiql/plugin-explorer": "https://esm.sh/@graphiql/plugin-explorer@4.0.0?standalone&external=react,react/jsx-runtime,react-dom,@graphiql/react,graphql",
          "@graphiql/react": "https://esm.sh/@graphiql/react@0.30.0?standalone&external=react,react/jsx-runtime,react-dom,graphql,@graphiql/toolkit",

          "@graphiql/toolkit": "https://esm.sh/@graphiql/toolkit@0.11.2?standalone&external=graphql",
          "graphql": "https://esm.sh/graphql@16.11.0"
        }
      }
    </script>
    <script type="module">
      // Import React and ReactDOM
      import React from 'react';
      import ReactDOM from 'react-dom/client';
      // Import GraphiQL and the Explorer plugin
      import { GraphiQL } from 'graphiql';
      import { createGraphiQLFetcher } from '@graphiql/toolkit';
      import { explorerPlugin } from '@graphiql/plugin-explorer';

      const fetcher = createGraphiQLFetcher({
        url: '${c.req.path}',
      });
      const explorer = explorerPlugin();

      function App() {
        return React.createElement(GraphiQL, {
          fetcher,
          plugins: [explorer],
        });
      }

      const container = document.getElementById('graphiql');
      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(App));
    </script>
  </head>
  <body>
    <div id="graphiql">
      <div class="loading">Loading…</div>
    </div>
  </body>
</html>
`)
}
