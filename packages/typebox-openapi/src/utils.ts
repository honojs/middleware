import type { TSchema } from '@sinclair/typebox'
import type { OpenAPIV3_1 } from 'openapi-types'
import type {
  HTTPMethod,
  OpenAPIRoute,
  RequestBodyObject,
  ResponseConfig,
  ResponsesObject,
} from './types'

export const mapProperties = (name: string, schema: TSchema | undefined) => {
  if (schema === undefined) return []

  return Object.entries(schema.properties ?? []).map(([key, value]) => {
    const { type: valueType = undefined, description, examples, ...schemaKeywords } = value as any
    return {
      description,
      schema: { type: valueType, examples, ...schemaKeywords },
      in: name,
      name: key,
      required: schema.required?.includes(key) ?? false,
    }
  })
}

export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

export const generateOperationId = (method: string, paths: string) => {
  let operationId = method.toLowerCase()

  if (paths === '/') return `${operationId}Index`

  for (const path of paths.split('/')) {
    if (path.charCodeAt(0) === 123) {
      operationId += `By${capitalize(path.slice(1, -1))}`
    } else {
      operationId += capitalize(path)
    }
  }

  return operationId
}

export const registerSchemaPath = ({
  schema,
  route,
  path,
  method,
}: {
  schema: {
    schemas: NonNullable<OpenAPIV3_1.ComponentsObject['schemas']>
    paths: Partial<OpenAPIV3_1.PathsObject>
  }
  route: OpenAPIRoute
  path: string
  method: HTTPMethod
}) => {
  const paramsSchema = registerModel(route.request.params, schema.schemas)
  const headerSchema = registerModel(route.request.headers, schema.schemas)
  const querySchema = registerModel(route.request.query, schema.schemas)
  const cookieSchema = registerModel(route.request.cookies, schema.schemas)
  const bodySchema = route.request.body
  const responses = route.responses

  if (bodySchema) {
    for (const contentTypeObject of Object.values(bodySchema.content)) {
      registerModel(contentTypeObject?.schema, schema.schemas)
    }
  }

  for (const responseObj of Object.values(responses ?? {})) {
    if ('content' in responseObj && responseObj.content) {
      for (const contentTypeObject of Object.values(responseObj.content)) {
        registerModel(contentTypeObject?.schema, schema.schemas)
      }
    }
  }

  const parameters = [
    ...mapProperties('header', headerSchema),
    ...mapProperties('path', paramsSchema),
    ...mapProperties('query', querySchema),
    ...mapProperties('cookie', cookieSchema),
  ]

  schema.paths[path] = {
    ...(schema.paths[path] ? schema.paths[path] : {}),
    [method.toLowerCase()]: {
      ...((headerSchema || paramsSchema || querySchema || bodySchema
        ? ({ parameters } as any)
        : {}) satisfies OpenAPIV3_1.ParameterObject),
      ...(responses
        ? {
            responses: mapResponses(responses),
          }
        : {}),
      operationId: route?.detail?.operationId ?? generateOperationId(method, path),
      ...route?.detail,
      ...(bodySchema
        ? {
            requestBody: {
              required: true,
              description: bodySchema.description,
              content: mapRequestBody(bodySchema),
            },
          }
        : null),
    } satisfies OpenAPIV3_1.OperationObject,
  }
}

const registerModel = (
  model: TSchema | undefined,
  schema: NonNullable<OpenAPIV3_1.ComponentsObject['schemas']>
) => {
  if (!model) return model

  const { $id, ...rest } = model
  if (!$id) return model

  if (!schema[$id]) schema[$id] = rest

  return model
}

const mapRequestBody = (body: RequestBodyObject): OpenAPIV3_1.RequestBodyObject['content'] => {
  return Object.fromEntries(
    Object.entries(body.content).map(([contentType, contentTypeObject]) => [
      contentType,
      {
        ...(contentTypeObject
          ? contentTypeObject.schema.$id
            ? {
                schema: {
                  $ref: `#/components/schemas/${contentTypeObject.schema.$id}`,
                },
              }
            : contentTypeObject
          : {}),
      },
    ])
  )
}

const mapResponses = (responses: ResponsesObject): OpenAPIV3_1.ResponsesObject => {
  return Object.fromEntries(
    Object.entries(responses).map(([statusCode, responseConfig]) => [
      statusCode,
      {
        ...responseConfig,
        description: responseConfig.description,
        content: mapResponseContent(responseConfig),
      },
    ])
  )
}

const mapResponseContent = (
  responseConfig: ResponseConfig
): OpenAPIV3_1.ResponseObject['content'] => {
  if (!('content' in responseConfig)) return {}
  const { content } = responseConfig
  return Object.fromEntries(
    Object.entries(content).map(([mediaType, contentTypeObject]) => [
      mediaType,
      {
        ...(contentTypeObject
          ? contentTypeObject.schema.$id
            ? {
                schema: {
                  $ref: `#/components/schemas/${contentTypeObject.schema.$id}`,
                },
              }
            : contentTypeObject
          : {}),
      },
    ])
  )
}
