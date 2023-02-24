import type { TSchema, Static } from '@sinclair/typebox'
import { TypeCompiler, type ValueError } from '@sinclair/typebox/compiler'
import type { Context, Env, MiddlewareHandler } from 'hono'
import { validator } from 'hono/validator'

type ValidationTargets = 'json' | 'form' | 'query' | 'queries'
type Hook<T> = (
  result: { success: true; data: T } | { success: false; errors: ValueError[] },
  c: Context
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
export function tbValidator<
  T extends TSchema,
  Target extends ValidationTargets,
  E extends Env,
  P extends string
>(
  target: Target,
  schema: T,
  hook?: Hook<Static<T>>
): MiddlewareHandler<E, P, { [K in Target]: Static<T> }> {
  // Compile the provided schema once rather than per validation. This could be optimized further using a shared schema
  // compilation pool similar to the Fastify implementation.
  const compiled = TypeCompiler.Compile(schema)
  return validator(target, (data, c) => {
    if (compiled.Check(data)) {
      if (hook) {
        const hookResult = hook({ success: true, data }, c)
        if (hookResult instanceof Response || hookResult instanceof Promise<Response>) {
          return hookResult
        }
      }
      return data
    }
    return c.json({ success: false, errors: [...compiled.Errors(data)] }, 400)
  })
}
