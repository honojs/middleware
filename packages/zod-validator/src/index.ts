import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'
import type { z, ZodSchema, ZodError } from 'zod'

export type Hook<T, E extends Env, P extends string, O = {}> = (
  result: { success: true; data: T } | { success: false; error: ZodError; data: T },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

export const zValidator = <
  T extends ZodSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: z.input<T> }
    out: { [K in Target]: z.output<T> }
  } = {
    in: { [K in Target]: z.input<T> }
    out: { [K in Target]: z.output<T> }
  }
>(
  target: Target,
  schema: T,
  hook?: Hook<z.infer<T>, E, P>
): MiddlewareHandler<E, P, V> =>
  validator(target, async (value, c) => {
    const result = await schema.safeParseAsync(value)

    if (hook) {
      const hookResult = hook({ data: value, ...result }, c)
      if (hookResult) {
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (!result.success) {
      return c.json(result, 400)
    }

    const data = result.data as z.infer<T>
    return data
  })
