import type { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'
import { ZodObject } from 'zod'
import type { ZodError, ZodSchema, z } from 'zod'

export type Hook<
  T,
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
  In = z.input<T>,
  Out = z.output<T>,
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
  hook?: Hook<z.infer<T>, E, P, Target>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    let validatorValue = value

    // in case where our `target` === `header`, Hono parses all of the headers into lowercase.
    // this might not match the Zod schema, so we want to make sure that we account for that when parsing the schema.
    if (target === 'header' && schema instanceof ZodObject) {
      // create an object that maps lowercase schema keys to lowercase
      const schemaKeys = Object.keys(schema.shape)
      const caseInsensitiveKeymap = Object.fromEntries(
        schemaKeys.map((key) => [key.toLowerCase(), key])
      )

      validatorValue = Object.fromEntries(
        Object.entries(value).map(([key, value]) => [caseInsensitiveKeymap[key] || key, value])
      )
    }

    const result = await schema.safeParseAsync(validatorValue)

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

    return result.data as z.infer<T>
  })
