import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'

import type { TSchema, Static } from 'typebox'
import { Compile } from 'typebox/compile'
import type { TLocalizedValidationError } from 'typebox/error'

export type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; errors: TLocalizedValidationError[] },
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
 * import { Type } from 'typebox'
 *
 * const User = Type.Object({
 *   name: Type.String(),
 *   age: Type.Number(),
 * })
 *
 * const route = app.post('/user', tbValidator('json', User), (c) => {
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
 * import { Type } from 'typebox'
 *
 * const User = Type.Object({
 *   name: Type.String(),
 *   age: Type.Number(),
 * })
 *
 * app.post(
 *   '/user',
 *   tbValidator('json', User, (result, c) => {
 *     if (!result.success) {
 *       return c.text('Invalid!', 400)
 *     }
 *   })
 *   //...
 * )
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcludeResponseType<T> = T extends Response & TypedResponse<any> ? never : T

/**
 * TypeBox Validator Middleware for Hono with support for JSON Schema.
 *
 * @param target - Validation target: 'json', 'query', 'param', 'header', 'cookie', or 'form'.
 * @param schema - TypeBox type or JSON Schema.
 * @param hook - Optional hook function for handling validation results.
 * @param useClean - Removes excess properties (TypeBox types only). Defaults to `false`.
 * @returns A Hono middleware handler.
 */
export function tbValidator<
  const T extends TSchema,
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
  useClean?: boolean
): MiddlewareHandler<E, P, V> {
  // This function JIT-compiles the given schema. If the environment does NOT support
  // the `unsafe-eval` Content-Security-Policy, TypeBox will fall back to dynamic
  // validation using Value.*. Ref: Cloudflare.
  const compiled = Compile(schema)
  return validator(target, (unprocessedData, c) => {
    const data = useClean ? compiled.Clean(unprocessedData) : unprocessedData

    if (compiled.Check(data)) {
      if (hook) {
        const hookResult = hook({ success: true, data }, c)
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
      }
      return data
    }

    const errors = compiled.Errors(data)
    if (hook) {
      const hookResult = hook({ success: false, errors }, c)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult
      }
    }

    return c.json({ success: false, errors }, 400)
  }) as MiddlewareHandler<E, P, V>
}
