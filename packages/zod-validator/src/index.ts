/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type * as v3 from 'zod/v3'
import { ZodObject as v3ZodObject } from 'zod/v3'
import { ZodObject as v4ZodObject } from 'zod/v4'
import type { ZodSafeParseResult as v4ZodSafeParseResult } from 'zod/v4'
import type * as v4 from 'zod/v4/core'

type ZodSchema = v3.ZodType | v4.$ZodType
type ZodError = v3.ZodError | v4.$ZodError
type ZodSafeParseResult<T, T2> = v3.SafeParseReturnType<T, T2> | v4ZodSafeParseResult<T>
type zInput<T> = T extends v3.ZodType ? v3.input<T> : T extends v4.$ZodType ? v4.input<T> : never
type zOutput<T> = T extends v3.ZodType ? v3.output<T> : T extends v4.$ZodType ? v4.output<T> : never
type zInfer<T> = T extends v3.ZodType ? v3.infer<T> : T extends v4.$ZodType ? v4.infer<T> : never

export type Hook<
  T extends ZodSchema,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = {},
> = (
  result: ({ success: true; data: T } | { success: false; error: ZodError; data: T }) & {
    target: Target
  },
  c: Context<E, P>
) => Response | void | TypedResponse<O> | Promise<Response | void | TypedResponse<O>>

type HasUndefined<T> = undefined extends T ? true : false

export const zValidator = <
  T extends ZodSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = zInput<T>,
  Out = zOutput<T>,
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
>(
  target: Target,
  schema: T,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore avoid the type error on build
  hook?: Hook<zInfer<T>, E, P, Target>,
  options?: {
    validationFunction: (
      schema: T,
      value: ValidationTargets[Target]
    ) => ZodSafeParseResult<any, any> | Promise<ZodSafeParseResult<any, any>>
  }
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    let validatorValue: unknown = value

    // in case where our `target` === `header`, Hono parses all of the headers into lowercase.
    // this might not match the Zod schema, so we want to make sure that we account for that when parsing the schema.
    if (
      (target === 'header' && schema instanceof v3ZodObject) ||
      (target === 'header' && schema instanceof v4ZodObject)
    ) {
      // create an object that maps lowercase schema keys to lowercase
      const schemaKeys = Object.keys(schema.shape)
      const caseInsensitiveKeymap = Object.fromEntries(
        schemaKeys.map((key) => [key.toLowerCase(), key])
      )

      validatorValue = Object.fromEntries(
        Object.entries(value).map(([key, value]) => [caseInsensitiveKeymap[key] || key, value])
      )
    }

    const result =
      options && options.validationFunction
        ? // @ts-expect-error schema is not type well
          await options.validationFunction(schema, validatorValue)
        : // @ts-expect-error z4.$ZodType has safeParseAsync
          await schema.safeParseAsync(validatorValue)

    if (hook) {
      const hookResult = await hook({ data: validatorValue, ...result, target }, c)
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

    return result.data as zInfer<T>
  })
