import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'

/**
 * What a module from `ata build` exports, and what any object with a
 * `validate` of this shape may stand in for. The `isValid` guard, when the
 * module's types declare one, carries the validated type.
 */
export interface CompiledValidator<T = unknown> {
  validate: (data: unknown) => { valid: boolean; errors?: readonly CompiledError[] }
  isValid?: (data: unknown) => data is T
}

/** One error from a compiled module. The fields match the runtime's lean shape. */
export interface CompiledError {
  keyword: string
  instancePath: string
  schemaPath: string
  params: Record<string, unknown>
  message: string
}

export type Hook<T, E extends Env, P extends string> = (
  result:
    | { success: true; data: T }
    | { success: false; errors: readonly CompiledError[]; data: unknown },
  c: Context<E, P>
) => Response | Promise<Response> | void

/** The 400 the middleware answers with when no hook returned a response. */
export type FailedResponse = Response &
  TypedResponse<{ success: false; errors: readonly CompiledError[] }, 400, 'json'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcludeResponseType<T> = T extends Response & TypedResponse<any> ? never : T

type Guarded<M> = M extends CompiledValidator<infer T> ? T : unknown

/**
 * Hono middleware over a validator compiled ahead of time with `ata build`.
 * The compiled module imports nothing, so this entry imports nothing either:
 * the engine stays out of the bundle, which matters on Cloudflare Workers and
 * anywhere the size of what ships is counted. A module from `ata build` with
 * its `.d.ts` types `c.req.valid()` from the schema; otherwise pass the type.
 *
 * ```ts
 * import { ataCompiled } from '@hono/ata-validator/compiled'
 * import * as user from './generated/user.schema.js' // from `ata build`
 *
 * app.post('/user', ataCompiled('json', user), (c) => {
 *   const data = c.req.valid('json')
 *   return c.json({ success: true, message: `${data.name} is ${data.age}` })
 * })
 * ```
 */
export function ataCompiled<
  M extends CompiledValidator,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  T = Guarded<M>,
  V extends {
    in: { [K in Target]: T }
    out: { [K in Target]: ExcludeResponseType<T> }
  } = {
    in: { [K in Target]: T }
    out: { [K in Target]: ExcludeResponseType<T> }
  },
>(target: Target, compiled: M, hook?: Hook<T, E, P>): MiddlewareHandler<E, P, V, FailedResponse> {
  // @ts-expect-error not typed well
  return validator(target, (data, c) => {
    const result = compiled.validate(data)
    if (result.valid) {
      if (hook) {
        const hookResult = hook({ success: true, data: data as T }, c as Context<E, P>)
        if (hookResult) {
          return hookResult
        }
      }
      return data
    }
    const errors = result.errors ?? []
    if (hook) {
      const hookResult = hook({ success: false, errors, data }, c as Context<E, P>)
      if (hookResult) {
        return hookResult
      }
    }
    return c.json({ success: false, errors }, 400)
  })
}
