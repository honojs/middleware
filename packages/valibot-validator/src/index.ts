import type { Context, MiddlewareHandler, Env, ValidationTargets, Input as HonoInput } from 'hono'
import { validator } from 'hono/validator'
import type { BaseSchema, Input, Output, SafeParseResult } from 'valibot'
import { safeParse } from 'valibot'

type Hook<T extends BaseSchema, E extends Env, P extends string> = (
  result: SafeParseResult<T>,
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void>

type HasUndefined<T> = undefined extends T ? true : false

export const vValidator = <
  T extends BaseSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = Input<T>,
  Out = Output<T>,
  I extends HonoInput = {
    in: HasUndefined<In> extends true
      ? {
          [K in Target]?: K extends 'json'
            ? In
            : HasUndefined<keyof ValidationTargets[K]> extends true
            ? { [K2 in keyof In]?: ValidationTargets[K][K2] }
            : { [K2 in keyof In]: ValidationTargets[K][K2] }
        }
      : {
          [K in Target]: K extends 'json'
            ? In
            : HasUndefined<keyof ValidationTargets[K]> extends true
            ? { [K2 in keyof In]?: ValidationTargets[K][K2] }
            : { [K2 in keyof In]: ValidationTargets[K][K2] }
        }
    out: { [K in Target]: Out }
  },
  V extends I = I
>(
  target: Target,
  schema: T,
  hook?: Hook<T, E, P>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
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
