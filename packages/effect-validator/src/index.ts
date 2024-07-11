import * as S from '@effect/schema/Schema'
import { Either } from 'effect'
import type { Env, Input, MiddlewareHandler, ValidationTargets } from 'hono'
import type { Simplify } from 'hono/utils/types'
import { validator } from 'hono/validator'

type RemoveReadonly<T> = { -readonly [P in keyof T]: RemoveReadonly<T[P]> }

type HasUndefined<T> = undefined extends T ? true : false

export const effectValidator = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends S.Schema.Variance<any, any, any>,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = Simplify<RemoveReadonly<S.Schema.Type<T>>>,
  Out = Simplify<RemoveReadonly<S.Schema.Type<T>>>,
  I extends Input = {
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
  schema: T
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    // @ts-expect-error not typed well
    const result = S.decodeUnknownEither(schema)(value)

    return Either.match(result, {
      onLeft: (error) => c.json({ success: false, error: JSON.parse(JSON.stringify(error)) }, 400),
      onRight: (data) => {
        c.req.addValidatedData(target, data as object)
        return data
      },
    })
  })
