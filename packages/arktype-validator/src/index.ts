/**
 * This module provides an ArkType validator middleware for Hono.
 * It allows you to validate incoming requests (query, JSON, form data, headers, etc.)
 * using ArkType schemas and provides a flexible hook for custom error handling.
 *
 * @module
 */
import { type } from 'arktype'
import type { Type, ArkErrors } from 'arktype'
import type { Context, MiddlewareHandler, Env, ValidationTargets, TypedResponse } from 'hono'
import { validator } from 'hono/validator'

/**
 * Defines a hook function that can be used to customize the response
 * when validation succeeds or fails.
 *
 * @template T The inferred type of the schema.
 * @template E The environment type.
 * @template P The path parameters type.
 * @template O The output type of the response.
 * @param result The validation result, either success or failure.
 * @param c The Hono context.
 * @returns A Hono Response, a Promise of a Response, void, or a TypedResponse.
 */
export type Hook<T, E extends Env, P extends string, O = {}> = (
  result: { success: false; data: unknown; errors: ArkErrors } | { success: true; data: T },
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

type HasUndefined<T> = undefined extends T ? true : false

/**
 * Specifies fields that should be restricted from error data
 * for security or privacy reasons, especially for sensitive targets like 'header'.
 */
const RESTRICTED_DATA_FIELDS = {
  header: ['cookie'],
}

/**
 * Creates a Hono middleware that validates incoming request data using an ArkType schema.
 * The middleware can target different parts of the request (e.g., 'json', 'query', 'header').
 * It also supports a custom hook for handling validation results.
 *
 * @template T The ArkType schema type.
 * @template Target The target of the validation (e.g., 'json', 'query', 'header').
 * @template E The environment type.
 * @template P The path parameters type.
 * @template I The inferred input type of the schema.
 * @template O The inferred output type of the schema.
 * @template V The validated variables type.
 * @param target The part of the request to validate (e.g., 'json', 'query', 'form', 'header', 'param', 'cookie').
 * @param schema The ArkType schema to apply for validation.
 * @param hook An optional hook function to customize behavior based on validation success or failure.
 * @returns A Hono middleware handler.
 */
export const arktypeValidator = <
  T extends Type,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  I = T['inferIn'],
  O = T['infer'],
  V extends {
    in: HasUndefined<I> extends true ? { [K in Target]?: I } : { [K in Target]: I }
    out: { [K in Target]: O }
  } = {
    in: HasUndefined<I> extends true ? { [K in Target]?: I } : { [K in Target]: I }
    out: { [K in Target]: O }
  },
>(
  target: Target,
  schema: T,
  hook?: Hook<T['infer'], E, P>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, (value, c) => {
    const out = schema(value)

    const hasErrors = out instanceof type.errors

    if (hook) {
      const hookResult = hook(
        hasErrors ? { success: false, data: value, errors: out } : { success: true, data: out },
        c
      )
      if (hookResult) {
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (hasErrors) {
      return c.json(
        {
          success: false,
          errors:
            target in RESTRICTED_DATA_FIELDS
              ? out.map((error) => {
                  const restrictedFields =
                    RESTRICTED_DATA_FIELDS[target as keyof typeof RESTRICTED_DATA_FIELDS] || []

                  if (
                    error &&
                    typeof error === 'object' &&
                    'data' in error &&
                    typeof error.data === 'object' &&
                    error.data !== null &&
                    !Array.isArray(error.data)
                  ) {
                    const dataCopy = { ...(error.data as Record<string, unknown>) }
                    for (const field of restrictedFields) {
                      delete dataCopy[field]
                    }

                    error.data = dataCopy
                  }

                  return error
                })
              : out,
        },
        400
      )
    }

    return out
  })
