import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'
import type { IValidation } from 'typia'

export type Hook<T, E extends Env, P extends string, O = {}> = (
  result: IValidation.ISuccess<T> | { success: false; errors: IValidation.IError[]; data: T },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Validation<O = any> = (input: unknown) => IValidation<O>
export type OutputType<T> = T extends Validation<infer O> ? O : never

export const typiaValidator = <
  T extends Validation,
  O extends OutputType<T>,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: O }
    out: { [K in Target]: O }
  } = {
    in: { [K in Target]: O }
    out: { [K in Target]: O }
  },
>(
  target: Target,
  validate: T,
  hook?: Hook<O, E, P>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    const result = validate(value)

    if (hook) {
      const hookResult = await hook({ ...result, data: value }, c)
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
      return c.json({ success: false, error: result.errors }, 400)
    }
    return result.data
  })
