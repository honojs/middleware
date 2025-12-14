import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Context, Env, Input, TypedResponse, ValidationTargets } from 'hono'
import type { Handler } from 'hono/types'
import { validator } from 'hono/validator'
import { sanitizeIssues } from './sanitize-issues'

type HasUndefined<T> = undefined extends T ? true : false

export type FailedResponse<T> = Response &
  TypedResponse<
    {
      readonly success: false
      readonly error: readonly StandardSchemaV1.Issue[]
      readonly data: T
    },
    400,
    'json'
  >
type MustBeResponse<T> =
  T extends Promise<infer U>
    ? Promise<MustBeResponse<U>>
    : T extends Response | TypedResponse
      ? T
      : never

type Hook<
  T,
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
  result: (
    | { success: true; data: T }
    | { success: false; error: readonly StandardSchemaV1.Issue[]; data: T }
  ) & {
    target: Target
  },
  c: Context<E, P>
) => R

/**
 * Validation middleware for libraries that support [Standard Schema](https://standardschema.dev/) specification.
 *
 * This middleware validates incoming request data against a provided schema
 * that conforms to the Standard Schema specification. It supports validation
 * of JSON bodies, headers, queries, forms, and other request targets.
 *
 * @param target - The request target to validate ('json', 'header', 'query', 'form', etc.)
 * @param schema - A schema object conforming to Standard Schema specification
 * @param hook - Optional hook function called with validation results for custom error handling
 * @returns A Hono middleware handler that validates requests and makes validated data available via `c.req.valid()`
 *
 * @example Basic JSON validation
 * ```ts
 * import { z } from 'zod'
 * import { sValidator } from '@hono/standard-validator'
 *
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 * })
 *
 * app.post('/author', sValidator('json', schema), (c) => {
 *   const data = c.req.valid('json')
 *   return c.json({
 *     success: true,
 *     message: `${data.name} is ${data.age}`,
 *   })
 * })
 * ```
 *
 * @example With custom error handling hook
 * ```ts
 * app.post(
 *   '/post',
 *   sValidator('json', schema, (result, c) => {
 *     if (!result.success) {
 *       return c.text('Invalid!', 400)
 *     }
 *   }),
 *   (c) => {
 *     // Handler code
 *   }
 * )
 * ```
 *
 * @example Header validation
 * ```ts
 * import { object, string } from 'valibot'
 *
 * const schema = object({
 *   'content-type': string(),
 *   'user-agent': string(),
 * })
 *
 * app.post('/author', sValidator('header', schema), (c) => {
 *   const headers = c.req.valid('header')
 *   // do something with headers
 * })
 * ```
 */
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
  V extends I = I,
  R extends
    | void
    | Response
    | TypedResponse<unknown>
    | Promise<Response | TypedResponse<unknown> | void> = FailedResponse<ValidationTargets[Target]>,
>(
  target: Target,
  schema: Schema,
  hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target, R>
): Handler<E, P, V, MustBeResponse<R>> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    const result = await schema['~standard'].validate(value)

    if (hook) {
      const hookResult = await hook(
        result.issues
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
      const processedIssues = sanitizeIssues(result.issues, schema['~standard'].vendor, target)

      return c.json({ data: value, error: processedIssues, success: false }, 400)
    }

    return result.value as StandardSchemaV1.InferOutput<Schema>
  })

export type { Hook }
export { sValidator }
