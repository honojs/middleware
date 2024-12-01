import { Schema as S, ParseResult, Either } from 'effect'
import type { Env, Input, MiddlewareHandler, ValidationTargets } from 'hono'
import type { Simplify } from 'hono/utils/types'
import { validator } from 'hono/validator'

type RemoveReadonly<T> = { -readonly [P in keyof T]: RemoveReadonly<T[P]> }

type HasUndefined<T> = undefined extends T ? true : false

export const effectValidator = <
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  Type,
  Encoded,
  In = Simplify<RemoveReadonly<Encoded>>,
  Out = Simplify<RemoveReadonly<Type>>,
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
  }
>(
  target: Target,
  schema: S.Schema<Type, Encoded, never>
): MiddlewareHandler<E, P, I> => {
  // @ts-expect-error not typed well
  return validator(target, async (value, c) => {
    const result = S.decodeUnknownEither(schema)(value)

    return Either.match(result, {
      onLeft: (error) =>
        c.json({ success: false, error: ParseResult.ArrayFormatter.formatErrorSync(error) }, 400),
      onRight: (data) => {
        c.req.addValidatedData(target, data as object)
        return data
      },
    })
  })
}
