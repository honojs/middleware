import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'
import { AssertError, ensure, type Predicate, type PredicateType } from 'unknownutil'

export type Hook<T, E extends Env, P extends string> = (
  result: { data: T; error: undefined } | { data: undefined; error: AssertError },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<T>

export const uValidator = <
  T,
  S extends Predicate<T>,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: PredicateType<S> }
    out: { [K in Target]: PredicateType<S> }
  } = {
    in: { [K in Target]: PredicateType<S> }
    out: { [K in Target]: PredicateType<S> }
  }
>(
  target: Target,
  schema: S,
  hook?: Hook<PredicateType<S>, E, P>
): MiddlewareHandler<E, P, V> =>
  validator(target, (value, c) => {
    let resultUnion: [AssertError, undefined] | [undefined, PredicateType<S>]

    try {
      resultUnion = [undefined, ensure(value, schema) as PredicateType<S>]
    } catch (error: unknown) {
      if (error instanceof AssertError) {
        resultUnion = [error, undefined]
      } else {
        throw new Error(undefined, { cause: error })
      }
    }

    const [error, data] = resultUnion

    if (hook) {
      const hookResult = hook(error ? { data: undefined, error } : { data, error: undefined }, c)
      if (hookResult) {
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (error) {
      return c.json({ success: false, error: error.message }, 400)
    }

    return value
  })
