import type { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type { StandardSchemaV1 } from '@standard-schema/spec'

type HasUndefined<T> = undefined extends T ? true : false
type TOrPromiseOfT<T> = T | Promise<T>

type Hook<
  T,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = {}
> = (
  result: (
    | { success: boolean; data: T }
    | { success: boolean; error: ReadonlyArray<StandardSchemaV1.Issue>; data: T }
  ) & {
    target: Target
  },
  c: Context<E, P>
) => TOrPromiseOfT<Response | void | TypedResponse<O>>

const isStandardSchemaValidator = (validator: unknown): validator is StandardSchemaV1 =>
  !!validator && typeof validator === 'object' && '~standard' in validator

const sValidator = <
  Schema extends StandardSchemaV1,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = StandardSchemaV1.InferInput<Schema>,
  Out = StandardSchemaV1.InferOutput<Schema>,
  I extends Input = {
    in: HasUndefined<In> extends true
      ? {
          [K in Target]?: In extends ValidationTargets[K]
            ? In
            : { [K2 in keyof In]?: ValidationTargets[K][K2] }
        }
      : {
          [K in Target]: In extends ValidationTargets[K]
            ? In
            : { [K2 in keyof In]: ValidationTargets[K][K2] }
        }
    out: { [K in Target]: Out }
  },
  V extends I = I
>(
  target: Target,
  schema: Schema,
  hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    const result = await schema['~standard'].validate(value)

    if (hook) {
      const hookResult = await hook(
        !!result.issues
          ? { data: value, error: result.issues, success: false, target }
          : { data: value, success: true, target },
        c
      )
      if (hookResult) {
        if (hookResult instanceof Response) {
          return hookResult
        }

        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (result.issues) {
      return c.json({ data: value, error: result.issues, success: false }, 400)
    }

    return result.value as StandardSchemaV1.InferOutput<Schema>
  })

export type { Hook }
export { sValidator }
