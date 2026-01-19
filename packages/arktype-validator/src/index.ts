import { type } from 'arktype'
import type { Type, ArkErrors } from 'arktype'
import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse, Input } from 'hono'
import { validator } from 'hono/validator'
import type { InferInput } from './utils'

export type Hook<
  T,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = {},
> = (
  result: ({ success: true; data: T } | { success: false; errors: ArkErrors; data: T }) & {
    target: Target
  },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

type HasUndefined<T> = undefined extends T ? true : false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractValidationResponse<VF> = VF extends (value: any, c: any) => infer R
  ? R extends Promise<infer PR>
    ? PR extends TypedResponse<infer T, infer S, infer F>
      ? TypedResponse<T, S, F>
      : PR extends Response
        ? PR
        : PR extends undefined
          ? never
          : never
    : R extends TypedResponse<infer T, infer S, infer F>
      ? TypedResponse<T, S, F>
      : R extends Response
        ? R
        : R extends undefined
          ? never
          : never
  : never

const RESTRICTED_DATA_FIELDS = {
  header: ['cookie'],
}

type MaybePromise<T> = T | Promise<T>

type ValidatorOptions<
  T extends Type,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
> = {
  /** Custom validation function */
  validationFunction?: (
    schema: T,
    value: ValidationTargets[Target]
  ) => MaybePromise<T['infer'] | ArkErrors>
  /** HTTP status for validation errors (default: 400) */
  errorStatus?: number
  /** Custom error formatter */
  formatError?: (errors: ArkErrors, c: Context) => unknown
  /** Fields to redact from error payloads per target */
  redact?: Partial<Record<keyof ValidationTargets, string[]>>
}

/**
 * Attempts to extract schema keys from an ArkType schema.
 * Returns an array of keys if successful, null otherwise.
 */
function getSchemaKeys(schema: Type): string[] | null {
  try {
    // ArkType exposes structure through .json property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const schemaJson = schema.json as any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (schemaJson && typeof schemaJson === 'object' && schemaJson.domain === 'object') {
      const keys: string[] = []

      // Extract required keys
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (Array.isArray(schemaJson.required)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const item of schemaJson.required) {
          if (item && typeof item === 'object' && 'key' in item) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            keys.push(item.key)
          }
        }
      }

      // Extract optional keys
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (Array.isArray(schemaJson.optional)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (const item of schemaJson.optional) {
          if (item && typeof item === 'object' && 'key' in item) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            keys.push(item.key)
          }
        }
      }

      return keys.length > 0 ? keys : null
    }

    return null
  } catch {
    // If we can't extract keys, fail silently
    return null
  }
}

type DefaultInput<Target extends keyof ValidationTargets, In, Out> = {
  in: HasUndefined<In> extends true
    ? {
        [K in Target]?: [In] extends [ValidationTargets[K]] ? In : InferInput<In, K>
      }
    : {
        [K in Target]: [In] extends [ValidationTargets[K]] ? In : InferInput<In, K>
      }
  out: { [K in Target]: Out }
}

// Overload: without hook and options
export function arktypeValidator<
  T extends Type,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = T['inferIn'],
  Out = T['infer'],
  I extends Input = DefaultInput<Target, In, Out>,
  V extends I = I,
>(target: Target, schema: T): MiddlewareHandler<E, P, V>

// Overload: with hook and/or options
export function arktypeValidator<
  T extends Type,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  HookFn extends Hook<InferredValue, E, P, Target, {}>,
  In = T['inferIn'],
  Out = T['infer'],
  I extends Input = DefaultInput<Target, In, Out>,
  V extends I = I,
  InferredValue = T['infer'],
>(
  target: Target,
  schema: T,
  hookOrOptions?: HookFn | ValidatorOptions<T, Target>,
  options?: ValidatorOptions<T, Target>
): MiddlewareHandler<E, P, V, ExtractValidationResponse<HookFn>>

// Implementation
export function arktypeValidator<
  T extends Type,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  HookFn extends Hook<InferredValue, E, P, Target, {}>,
  In = T['inferIn'],
  Out = T['infer'],
  I extends Input = DefaultInput<Target, In, Out>,
  V extends I = I,
  InferredValue = T['infer'],
>(
  target: Target,
  schema: T,
  hookOrOptions?: HookFn | ValidatorOptions<T, Target>,
  options?: ValidatorOptions<T, Target>
): MiddlewareHandler<E, P, V> | MiddlewareHandler<E, P, V, ExtractValidationResponse<HookFn>> {
  // Determine if first optional param is hook or options
  const hook = typeof hookOrOptions === 'function' ? hookOrOptions : undefined
  const opts = typeof hookOrOptions === 'object' ? hookOrOptions : options

  // Merge default redact with user options
  const redactFields = {
    ...RESTRICTED_DATA_FIELDS,
    ...(opts?.redact ?? {}),
  }
  // @ts-expect-error Hono's validator callback return type inference is complex - type widening causes issues
  return validator(
    target,
    // @ts-expect-error Hono's validator callback return type inference is complex - type widening causes issues
    async (value: ValidationTargets[Target], c): Promise<T['infer'] | Response> => {
      let validatorValue = value

      // Header key normalization: Hono lowercases headers, but schema might expect mixed case
      if (target === 'header') {
        const schemaKeys = getSchemaKeys(schema)
        if (schemaKeys) {
          const keyMap = Object.fromEntries(schemaKeys.map((k) => [k.toLowerCase(), k]))
          validatorValue = Object.fromEntries(
            Object.entries(value).map(([k, v]) => [keyMap[k.toLowerCase()] ?? k, v])
          ) as ValidationTargets[Target]
        }
      }

      // Run validation
      const validationFunction = opts?.validationFunction
      const out = await (validationFunction
        ? validationFunction(schema, validatorValue)
        : schema(validatorValue))

      const hasErrors = out instanceof type.errors

      // Call hook with target included
      if (hook) {
        const hookResult = await hook(
          // @ts-expect-error Type narrowing for ArkErrors vs T['infer']
          hasErrors
            ? { success: false, data: validatorValue, errors: out, target }
            : { success: true, data: out, target },
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

      if (hasErrors) {
        const fieldsToRedact = redactFields[target as keyof typeof redactFields] ?? []
        const sanitizedErrors =
          target in redactFields
            ? (out.map((error) => {
                if (
                  error &&
                  typeof error === 'object' &&
                  'data' in error &&
                  typeof (error as { data?: unknown }).data === 'object' &&
                  (error as { data?: unknown }).data !== null &&
                  !Array.isArray((error as { data?: unknown }).data)
                ) {
                  const originalData = (error as { data: Record<string, unknown> }).data
                  const dataCopy = Object.fromEntries(
                    Object.entries(originalData).filter(([key]) => !fieldsToRedact.includes(key))
                  )
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  const clonedError = Object.assign(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    Object.create(Object.getPrototypeOf(error)),
                    error
                  )

                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  clonedError.data = dataCopy

                  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                  return clonedError
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument
                return Object.assign(Object.create(Object.getPrototypeOf(error)), error)
              }) as unknown as ArkErrors)
            : out

        const errorStatus = opts?.errorStatus ?? 400
        const errorPayload = opts?.formatError
          ? opts.formatError(sanitizedErrors, c)
          : { success: false, errors: sanitizedErrors }

        // @ts-expect-error errorStatus may not be a ContentfulStatusCode literal
        return c.json(errorPayload, errorStatus)
      }

      return out
    }
  )
}
