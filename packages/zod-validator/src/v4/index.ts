import type { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import type { ZodSafeParseResult, ZodType } from 'zod/v4'
import type { input, output, $ZodError, $ZodObjectDef } from 'zod/v4/core'

export type Hook<
  T,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = {},
> = (
  result: ({ success: true; data: T } | { success: false; error: $ZodError; data: T }) & {
    target: Target
  },
  c: Context<E, P>
) => Response | void | TypedResponse<O> | Promise<Response | void | TypedResponse<O>>

type HasUndefined<T> = undefined extends T ? true : false

export const zValidator = <
  T extends ZodType,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = input<T>,
  Out = output<T>,
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
  hook?: Hook<output<T>, E, P, Target>,
  options?: {
    validationFunction: (
      schema: T,
      value: ValidationTargets[Target]
    ) => ZodSafeParseResult<output<T>> | Promise<ZodSafeParseResult<output<T>>>
  }
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    let validatorValue = value

    // in case where our `target` === `header`, Hono parses all of the headers into lowercase.
    // this might not match the Zod schema, so we want to make sure that we account for that when parsing the schema.
    if (target === 'header' && schema._zod.def.type === 'object') {
      // create an object that maps lowercase schema keys to lowercase
      const schemaKeys = Object.keys((schema._zod.def as $ZodObjectDef).shape)
      const caseInsensitiveKeymap = Object.fromEntries(
        schemaKeys.map((key) => [key.toLowerCase(), key])
      )

      validatorValue = Object.fromEntries(
        Object.entries(value).map(([key, value]) => [caseInsensitiveKeymap[key] || key, value])
      )
    }

    const result =
      options && options.validationFunction
        ? await options.validationFunction(schema, validatorValue)
        : await schema.safeParseAsync(validatorValue)

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

    return result.data as output<T>
  })
