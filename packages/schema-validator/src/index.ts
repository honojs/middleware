import type { Env, Input, MiddlewareHandler, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import * as S from '@effect/schema/Schema'
import { Either } from 'effect'

type HasUndefined<T> = undefined extends T ? true : false

export const schemaValidator = <
  T,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = S.Schema.Type<T>,
  Out = S.Schema.Type<T>,
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
  schema: S.Schema<T>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    const result = S.decodeUnknownEither(schema)(value)

    return Either.match(result, {
      onLeft: (error) => c.json({ success: false, error: JSON.parse(JSON.stringify(error)) }, 400),
      onRight: (data) => {
        c.req.addValidatedData(target, data as object)
        return data
      }
    }) as S.Schema.Type<T>
  })