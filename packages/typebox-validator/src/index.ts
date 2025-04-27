import type { TSchema, Static } from '@sinclair/typebox'
import { TypeGuard, ValueGuard } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { ValueError } from '@sinclair/typebox/value'
import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import IsObject = ValueGuard.IsObject
import IsArray = ValueGuard.IsArray

export type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; errors: ValueError[] },
  c: Context<E, P>
) => Response | Promise<Response> | void

/**
 * Hono middleware that validates incoming data via a [TypeBox](https://github.com/sinclairzx81/typebox) schema.
 *
 * ---
 *
 * No Hook
 *
 * ```ts
 * import { tbValidator } from '@hono/typebox-validator'
 * import { Type as T } from '@sinclair/typebox'
 *
 * const schema = T.Object({
 *   name: T.String(),
 *   age: T.Number(),
 * })
 *
 * const route = app.post('/user', tbValidator('json', schema), (c) => {
 *   const user = c.req.valid('json')
 *   return c.json({ success: true, message: `${user.name} is ${user.age}` })
 * })
 * ```
 *
 * ---
 * Hook
 *
 * ```ts
 * import { tbValidator } from '@hono/typebox-validator'
 * import { Type as T } from '@sinclair/typebox'
 *
 * const schema = T.Object({
 *   name: T.String(),
 *   age: T.Number(),
 * })
 *
 * app.post(
 *   '/user',
 *   tbValidator('json', schema, (result, c) => {
 *     if (!result.success) {
 *       return c.text('Invalid!', 400)
 *     }
 *   })
 *   //...
 * )
 * ```
 */

type ExcludeResponseType<T> = T extends Response & TypedResponse<any> ? never : T

export function tbValidator<
  T extends TSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: Static<T> }
    out: { [K in Target]: ExcludeResponseType<Static<T>> }
  },
>(
  target: Target,
  schema: T,
  hook?: Hook<Static<T>, E, P>,
  stripNonSchemaItems?: boolean
): MiddlewareHandler<E, P, V> {
  // @ts-expect-error not typed well
  // Compile the provided schema once rather than per validation. This could be optimized further using a shared schema
  // compilation pool similar to the Fastify implementation.
  return validator(target, (unprocessedData, c) => {
    const data = stripNonSchemaItems
      ? removeNonSchemaItems(schema, unprocessedData)
      : unprocessedData

    if (Value.Check(schema, data)) {
      if (hook) {
        const hookResult = hook({ success: true, data }, c)
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
      }
      return data
    }

    const errors = Array.from(Value.Errors(schema, data))
    if (hook) {
      const hookResult = hook({ success: false, errors }, c)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult
      }
    }

    return c.json({ success: false, errors }, 400)
  })
}

function removeNonSchemaItems<T extends TSchema>(schema: T, obj: any): Static<T> {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeNonSchemaItems(schema.items, item))
  }

  const result: any = {}
  for (const key in schema.properties) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const propertySchema = schema.properties[key]
      if (IsObject(propertySchema) && !IsArray(propertySchema)) {
        result[key] = removeNonSchemaItems(propertySchema as unknown as TSchema, obj[key])
      } else {
        result[key] = obj[key]
      }
    }
  }

  return result
}
