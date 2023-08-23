import type { Context, MiddlewareHandler, Env, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type { BaseSchema, Input, Output, SafeParseResult } from 'valibot'
import { safeParse } from 'valibot'

type Hook<T extends BaseSchema, E extends Env, P extends string> = (
  result: SafeParseResult<T>,
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void>

export const vValidator = <
  T extends BaseSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: Input<T> }
    out: { [K in Target]: Output<T> }
  } = {
    in: { [K in Target]: Input<T> }
    out: { [K in Target]: Output<T> }
  }
>(
  target: Target,
  schema: T,
  hook?: Hook<T, E, P>
): MiddlewareHandler<E, P, V> =>
  validator(target, (value, c) => {
    const result = safeParse(schema, value)

    if (hook) {
      const hookResult = hook(result, c)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult
      }
    }

    if (!result.success) {
      return c.json(result, 400)
    }

    const data = result.output as Output<T>
    return data
  })
