import type { Type, Problems } from 'arktype'
import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'

export type Hook<T, E extends Env, P extends string, O = {}> = (
  result: { success: false; data: unknown; problems: Problems } | { success: true; data: T },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

type HasUndefined<T> = undefined extends T ? true : false

export const arktypeValidator = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Type<any>,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  I = T['inferIn'],
  O = T['infer'],
  V extends {
    in: HasUndefined<I> extends true ? { [K in Target]?: I } : { [K in Target]: I }
    out: { [K in Target]: O }
  } = {
    in: HasUndefined<I> extends true ? { [K in Target]?: I } : { [K in Target]: I }
    out: { [K in Target]: O }
  }
>(
  target: Target,
  schema: T,
  hook?: Hook<T['infer'], E, P>
): MiddlewareHandler<E, P, V> =>
  validator(target, (value, c) => {
    const { data, problems } = schema(value)

    if (hook) {
      const hookResult = hook(
        problems ? { success: false, data: value, problems } : { success: true, data },
        c
      )
      if (hookResult) {
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (problems) {
      return c.json(
        {
          success: false,
          problems: problems.map((problem) => ({ ...problem, message: problem.toString() })),
        },
        400
      )
    }

    return data
  })
