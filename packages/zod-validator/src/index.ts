import type { Context, MiddlewareHandler, Env, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type { z, ZodSchema, ZodError } from 'zod'

type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; error: ZodError },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void>

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
  validator(target, (value, c) => {
    const result = schema.safeParse(value)

    if (hook) {
      const hookResult = hook(result, c)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult
      }
    }

    if (!result.success) {
      return c.json(result, 400)
    }

    const data = result.data as z.infer<T>
    return data
  })
