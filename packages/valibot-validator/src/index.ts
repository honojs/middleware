import type { Context, Env, Handler, Input, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type {
  GenericSchema,
  GenericSchemaAsync,
  InferInput,
  InferOutput,
  SafeParseResult,
} from 'valibot'
import { safeParseAsync } from 'valibot'

export type FailedResponse<T extends GenericSchema | GenericSchemaAsync> =
  SafeParseResult<T> extends infer U
    ? Response & TypedResponse<U extends { success: false } ? U : never, 400, 'json'>
    : never

type MustBeResponse<T, Schema extends GenericSchema | GenericSchemaAsync> =
  T extends Promise<infer U>
    ? Promise<MustBeResponse<U, Schema>>
    : T extends Response | TypedResponse<unknown>
      ? T
      : never

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

const RESTRICTED_DATA_FIELDS: Partial<Record<keyof ValidationTargets, string[]>> = {
  header: ['cookie'],
}

const omitFields = (value: unknown, fields: string[]): unknown => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)))
}

/**
 * Removes sensitive fields (like cookies) from the `input` of each issue and of each
 * path item, so that the default 400 response does not echo them back to the client.
 */
const sanitizeResult = <T extends GenericSchema | GenericSchemaAsync>(
  result: SafeParseResult<T>,
  target: keyof ValidationTargets
): SafeParseResult<T> => {
  const fields = RESTRICTED_DATA_FIELDS[target]
  if (!fields || result.success) {
    return result
  }
  return {
    ...result,
    issues: result.issues.map((issue) => ({
      ...issue,
      input: omitFields(issue.input, fields),
      path: issue.path?.map((item) => ({ ...item, input: omitFields(item.input, fields) })),
    })),
  } as SafeParseResult<T>
}

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
    | Promise<Response | TypedResponse<unknown> | void> = FailedResponse<T>,
>(
  target: Target,
  schema: T,
  hook?: Hook<T, E, P, Target, R>
): Handler<E, P, V, MustBeResponse<R, T>> =>
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
      return c.json(sanitizeResult(result, target), 400)
    }

    return result.output
  })
