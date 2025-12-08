import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type { Static, TErrorOptions } from 'typedriver'
import { compile } from 'typedriver'

export type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; errors: object[] },
  c: Context<E, P>
) => Response | Promise<Response> | void

/**
 * Hono middleware that validates incoming data via [TypeDriver](https://github.com/sinclairzx81/typedriver).
 * Supports TypeScript DSL, JSON Schema, and Standard Schema (Zod, Valibot, ArkType, TypeBox, etc.)
 *
 * ---
 *
 * No Hook
 *
 * ```ts
 * import { tdValidator } from '@hono/typedriver-validator'
 *
 * const route = app.post('/user', tdValidator('json', `{
 *   name: string,
 *   age: number
 * }`), (c) => {
 *   const user = c.req.valid('json')
 *   return c.json({ success: true, message: `${user.name} is ${user.age}` })
 * })
 * ```
 *
 * ---
 * Hook
 *
 * ```ts
 * import { tdValidator } from '@hono/typedriver-validator'
 *
 * app.post(
 *   '/user',
 *   tdValidator('json', `{
 *     name: string,
 *     age: number
 *   }`, (result, c) => {
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
 * TypeDriver Validator Middleware for Hono with support for multiple schema formats.
 *
 * @param target - Validation target: 'json', 'query', 'param', 'header', 'cookie', or 'form'.
 * @param schema - TypeScript DSL, JSON Schema, or Standard Schema (Zod, Valibot, ArkType, TypeBox, etc.)
 * @param hook - Optional hook function for handling validation results.
 * @param options - Optional TypeDriver error options (format, locale, etc.)
 * @returns A Hono middleware handler.
 */
export function tdValidator<
  const T,
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
  options?: TErrorOptions
): MiddlewareHandler<E, P, V> {
  const compiled = compile(schema)
  return validator(target, (data, context) => {
    if (compiled.check(data)) {
      if (hook) {
        const hookResult = hook({ success: true, data }, context)
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
      }
      return data
    }
    const errors = compiled.errors(data, options)
    if (hook) {
      const hookResult = hook({ success: false, errors }, context)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult
      }
    }

    return context.json({ success: false, errors }, 400)
  }) as MiddlewareHandler<E, P, V>
}
