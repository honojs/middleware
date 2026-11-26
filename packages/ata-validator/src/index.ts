import type { Infer, JSONSchema, ValidationError, Validator as AtaValidator } from 'ata-validator'
import { Validator } from 'ata-validator'
import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'

export type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; errors: ValidationError[]; data: unknown },
  c: Context<E, P>
) => Response | Promise<Response> | void

/**
 * The response sent when validation fails and no hook returned one:
 * `{ success: false, errors }` with status 400, where `errors` is the
 * validator's error list. From a schema each error carries `keyword`,
 * `instancePath`, `schemaPath`, `params` and `message`; from a prepared
 * `Validator` it is whatever that validator reports, rich by default.
 */
export type FailedResponse = Response &
  TypedResponse<{ success: false; errors: ValidationError[] }, 400, 'json'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcludeResponseType<T> = T extends Response & TypedResponse<any> ? never : T

// A schema written `as const` infers a readonly shape; the handler gets the
// plain one, as with the other validators.
type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T

/** The data type a JSON Schema literal describes, as the handler receives it. */
export type Static<S extends JSONSchema> = Mutable<Infer<S>>

/**
 * Hono middleware that validates incoming data with
 * [ata-validator](https://github.com/ata-core/ata-validator), a JSON Schema
 * validator. The schema is plain JSON Schema (draft 7, 2019-09, 2020-12 or
 * the v1 dialect); written as a literal, it also types the validated data.
 * Where dynamic code is refused, on Cloudflare Workers or under a strict
 * Content-Security-Policy, the validator runs its interpreted engine, so the
 * middleware works there without a flag.
 *
 * ---
 *
 * No Hook
 *
 * ```ts
 * import { ataValidator } from '@hono/ata-validator'
 *
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name', 'age'],
 *   additionalProperties: false,
 * } as const
 *
 * const route = app.post('/user', ataValidator('json', schema), (c) => {
 *   const user = c.req.valid('json')
 *   return c.json({ success: true, message: `${user.name} is ${user.age}` })
 * })
 * ```
 *
 * ---
 * Hook
 *
 * ```ts
 * app.post(
 *   '/user',
 *   ataValidator('json', schema, (result, c) => {
 *     if (!result.success) {
 *       return c.text('Invalid!', 400)
 *     }
 *   })
 *   //...
 * )
 * ```
 *
 * ---
 * A prepared validator, for options such as `coerceTypes` on a query string,
 * or for the rich error shape (code, expected, received, docUrl)
 *
 * ```ts
 * import { Validator } from 'ata-validator'
 *
 * const page = new Validator(
 *   { type: 'object', properties: { page: { type: 'integer', minimum: 1 } } } as const,
 *   { coerceTypes: true }
 * )
 * app.get('/posts', ataValidator('query', page), (c) => {
 *   const { page } = c.req.valid('query') // a number
 *   // ...
 * })
 * ```
 */
export function ataValidator<
  const S extends JSONSchema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: Static<S> }
    out: { [K in Target]: ExcludeResponseType<Static<S>> }
  },
>(
  target: Target,
  schema: S,
  hook?: Hook<Static<S>, E, P>
): MiddlewareHandler<E, P, V, FailedResponse>

export function ataValidator<
  T,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: Mutable<T> }
    out: { [K in Target]: ExcludeResponseType<Mutable<T>> }
  },
>(
  target: Target,
  validator: AtaValidator<T>,
  hook?: Hook<Mutable<T>, E, P>
): MiddlewareHandler<E, P, V, FailedResponse>

export function ataValidator<
  T,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  V extends {
    in: { [K in Target]: T }
    out: { [K in Target]: ExcludeResponseType<T> }
  },
>(
  target: Target,
  schemaOrValidator: JSONSchema | AtaValidator<T>,
  hook?: Hook<Mutable<T>, E, P>
): MiddlewareHandler<E, P, V, FailedResponse> {
  // A schema compiles with the lean error shape (keyword, instancePath,
  // schemaPath, params, message): it is what a 400 body needs, and it keeps
  // that response small. The rich shape (code, expected, received, docUrl)
  // comes with a prepared `Validator`, which is rich by default.
  const compiled = isValidator(schemaOrValidator)
    ? schemaOrValidator
    : new Validator<T>(schemaOrValidator as object | boolean, { richErrors: false })
  // @ts-expect-error not typed well
  return validator(target, (data, c) => {
    // `data` is the parsed value the validator may have completed with
    // defaults or coerced, so the handler sees what was validated.
    const result = compiled.validate(data)
    if (result.valid) {
      if (hook) {
        const hookResult = hook(
          { success: true, data: result.data as Mutable<T> },
          c as Context<E, P>
        )
        if (hookResult) {
          return hookResult
        }
      }
      return result.data
    }
    if (hook) {
      const hookResult = hook({ success: false, errors: result.errors, data }, c as Context<E, P>)
      if (hookResult) {
        return hookResult
      }
    }
    return c.json({ success: false, errors: result.errors }, 400)
  })
}

function isValidator<T>(value: JSONSchema | AtaValidator<T>): value is AtaValidator<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AtaValidator<T>).validate === 'function' &&
    typeof (value as AtaValidator<T>).isValidObject === 'function'
  )
}
