import {
  Source,
  parse,
  execute,
  validateSchema,
  validate,
  specifiedRules,
  getOperationAST,
  GraphQLError,
} from 'https://esm.sh/graphql@16.6.0'

import type {
  GraphQLSchema,
  DocumentNode,
  ValidationRule,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from 'https://esm.sh/graphql@16.6.0'

import type { Context } from 'https://deno.land/x/hono@v3.0.0/mod.ts'
import { parseBody } from './parse-body.ts'
import { HonoRequest } from "https://deno.land/x/hono@v3.0.0/request.ts";

export type RootResolver = (ctx?: Context) => Promise<unknown> | unknown

type Options = {
  schema: GraphQLSchema
  rootResolver?: RootResolver
  pretty?: boolean
  validationRules?: ReadonlyArray<ValidationRule>
  // graphiql?: boolean
}

export const graphqlServer = (options: Options) => {
  const schema = options.schema
  const pretty = options.pretty ?? false
  const validationRules = options.validationRules ?? []
  // const showGraphiQL = options.graphiql ?? false

  return async (c: Context) => {
    // GraphQL HTTP only supports GET and POST methods.
    if (c.req.method !== 'GET' && c.req.method !== 'POST') {
      return c.json(errorMessages(['GraphQL only supports GET and POST requests.']), 405, {
        Allow: 'GET, POST',
      })
    }

    let params: GraphQLParams
    try {
      params = await getGraphQLParams(c.req)
    } catch (e) {
      if (e instanceof Error) {
        console.error(`${e.stack || e.message}`)
        return c.json(errorMessages([e.message], [e]), 400)
      }
      throw e
    }

    const { query, variables, operationName } = params

    if (query == null) {
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
        /*
        Now , does not support GraphiQL
        if (showGraphiQL) {
          //return respondWithGraphiQL(response, graphiqlOptions, params)
        }
        */

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

    /*
    Now, does not support GraphiQL
    if (showGraphiQL) {
    }
    */

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

export const getGraphQLParams = async (request: HonoRequest): Promise<GraphQLParams> => {
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
) => {
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

// export const graphiQLResponse = () => {}
