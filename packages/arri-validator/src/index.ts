import type { ASchemaWithAdapters, InferType, Result, ValueError } from '@arrirpc/schema'
import { a } from '@arrirpc/schema'
import type { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'

export type Hook<
  T,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = Record<string, unknown>,
> = (
  result: ({ success: true; data: T } | { success: false; error: ValueError[]; data: T }) & {
    target: Target
  },
  c: Context<E, P>
) => Response | TypedResponse<O> | undefined | Promise<Response | TypedResponse<O> | undefined>

type HasUndefined<T> = undefined extends T ? true : false

export const aValidator = <
  T extends ASchemaWithAdapters,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = InferType<T>,
  Out = InferType<T>,
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
  hook?: Hook<InferType<T>, E, P, Target>,
  options?: {
    validationFunction: (
      schema: T,
      value: ValidationTargets[Target]
    ) => Result<InferType<T>> | Promise<Result<InferType<T>>>
  }
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well in hono
  validator(target, async (value, c) => {
    let validatorValue = value

    // Handle headers case - Hono parses all headers into lowercase
    if (target === 'header' && a.validate(a.object({}, { strict: false }), schema)) {
      try {
        // Create an object that maps lowercase schema keys to original keys
        const schemaKeys = Object.keys(schema as Record<string, unknown>)
        const caseInsensitiveKeymap = Object.fromEntries(
          schemaKeys.map((key) => [key.toLowerCase(), key])
        )

        validatorValue = Object.fromEntries(
          Object.entries(value).map(([key, value]) => [caseInsensitiveKeymap[key] || key, value])
        )
      } catch (error) {
        // If we can't process the schema keys, just use the original value
        console.error('Error processing header schema keys:', error)
      }
    }

    const result = options?.validationFunction
      ? await options.validationFunction(schema, validatorValue)
      : a.parse(schema, validatorValue)

    if (hook) {
      const hookArg = result.success
        ? { success: true as const, data: validatorValue, target }
        : { success: false as const, error: result.errors, data: validatorValue, target }

      const hookResult = await hook(hookArg, c)
      if (hookResult) {
        return hookResult
      }
    }

    if (!result.success) {
      return c.json(result, 400)
    }

    return result.value as InferType<T>
  })
