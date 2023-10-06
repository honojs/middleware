import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'
import { AssertError, ensure, type Predicate, type PredicateType } from 'unknownutil'

export type Hook<T, E extends Env, P extends string> = (
  result: { data: T | undefined; error: AssertError | undefined },
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
  hook?: Hook<T, E, P>
): MiddlewareHandler<E, P, V> =>
  validator(target, (value, c) => {
    let resultUnion: [AssertError, undefined] | [undefined, T]

    try {
      resultUnion = [undefined, ensure(value, schema)]
    } catch (error: any) {
      if (error instanceof AssertError) {
        resultUnion = [error, undefined]
      }
      throw new Error(undefined, { cause: error })
    }

    if (hook) {
      const hookResult = hook({ error: resultUnion[0], data: resultUnion[1] }, c)
      if (hookResult) {
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    return value
  })
