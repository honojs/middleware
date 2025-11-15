import type { Context, Env, Handler, Input, TypedResponse, ValidationTargets } from 'hono'
import type { HandlerResponse } from 'hono/types'
import { validator } from 'hono/validator'
import type {
  GenericSchema,
  GenericSchemaAsync,
  InferInput,
  InferOutput,
  SafeParseResult,
} from 'valibot'
import { safeParseAsync } from 'valibot'

type FailedResult<T extends { readonly success: boolean }> = T extends { readonly success: false }
  ? T
  : never
type DefaultResponse<T, Schema extends GenericSchema | GenericSchemaAsync> =
  T extends Promise<infer U>
    ? Promise<DefaultResponse<U, Schema>>
    : T extends HandlerResponse<unknown>
      ? T
      : Response & TypedResponse<FailedResult<SafeParseResult<Schema>>, 400, 'json'>

export type Hook<
  T extends GenericSchema | GenericSchemaAsync,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  R extends
    | void
    | Response
    | TypedResponse<unknown>
    | Promise<Response | TypedResponse<unknown> | void> =
    | void
    | Response
    | TypedResponse<unknown>
    | Promise<Response | TypedResponse<unknown> | void>,
> = (
  result: SafeParseResult<T> & {
    target: Target
  },
  c: Context<E, P>
) => R

type HasUndefined<T> = undefined extends T ? true : false

export const vValidator = <
  T extends GenericSchema | GenericSchemaAsync,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = InferInput<T>,
  Out = InferOutput<T>,
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
  V extends I = I,
  R extends
    | void
    | Response
    | TypedResponse<unknown>
    | Promise<Response | TypedResponse<unknown> | void> = DefaultResponse<void, T>,
>(
  target: Target,
  schema: T,
  hook?: Hook<T, E, P, Target, R>
): Handler<E, P, V, DefaultResponse<R, T>> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    const result = await safeParseAsync(schema, value)

    if (hook) {
      const hookResult = await hook({ ...result, target }, c)
      if (hookResult) {
        if (hookResult instanceof Response) {
          return hookResult
        }

        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (!result.success) {
      return c.json(result, 400)
    }

    return result.output
  })
