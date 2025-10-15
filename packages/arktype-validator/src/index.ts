import { type } from 'arktype'
import type { Type, ArkErrors } from 'arktype'
import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'

export type Hook<T, E extends Env, P extends string, O = {}> = (
  result: { success: false; data: unknown; errors: ArkErrors } | { success: true; data: T },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

type HasUndefined<T> = undefined extends T ? true : false

const RESTRICTED_DATA_FIELDS = {
  header: ['cookie'],
}

export const arktypeValidator = <
  T extends Type,
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
  },
>(
  target: Target,
  schema: T,
  hook?: Hook<T['infer'], E, P>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, (value, c) => {
    const out = schema(value)

    const hasErrors = out instanceof type.errors

    if (hook) {
      const hookResult = hook(
        hasErrors ? { success: false, data: value, errors: out } : { success: true, data: out },
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

    if (hasErrors) {
      return c.json(
        {
          success: false,
          errors:
            target in RESTRICTED_DATA_FIELDS
              ? out.map((error) => {
                  const restrictedFields =
                    RESTRICTED_DATA_FIELDS[target as keyof typeof RESTRICTED_DATA_FIELDS] || []

                  if (
                    error &&
                    typeof error === 'object' &&
                    'data' in error &&
                    typeof error.data === 'object' &&
                    error.data !== null &&
                    !Array.isArray(error.data)
                  ) {
                    const dataCopy = { ...(error.data as Record<string, unknown>) }
                    for (const field of restrictedFields) {
                      delete dataCopy[field]
                    }

                    error.data = dataCopy
                  }

                  return error
                })
              : out,
        },
        400
      )
    }

    return out
  })
