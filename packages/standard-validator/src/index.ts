import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'

type HasUndefined<T> = undefined extends T ? true : false
type TOrPromiseOfT<T> = T | Promise<T>

type Hook<
  T,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = {},
> = (
  result: (
    | { success: true; data: T }
    | { success: false; error: readonly StandardSchemaV1.Issue[]; data: T }
  ) & {
    target: Target
  },
  c: Context<E, P>
) => TOrPromiseOfT<Response | void | TypedResponse<O>>

const RESTRICTED_DATA_FIELDS = {
  header: ['cookie'],
}

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
>(
  target: Target,
  schema: Schema,
  hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target>
): MiddlewareHandler<E, P, V> =>
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
      let processedIssues = result.issues

      // Strip sensitive data
      if (schema['~standard'].vendor === 'arktype' && target in RESTRICTED_DATA_FIELDS) {
        const restrictedFields =
          RESTRICTED_DATA_FIELDS[target as keyof typeof RESTRICTED_DATA_FIELDS] || []

        processedIssues = result.issues.map((issue) => {
          if (
            issue &&
            typeof issue === 'object' &&
            'data' in issue &&
            typeof issue.data === 'object' &&
            issue.data !== null &&
            !Array.isArray(issue.data)
          ) {
            const dataCopy = { ...(issue.data as Record<string, unknown>) }
            for (const field of restrictedFields) {
              delete dataCopy[field]
            }
            return { ...issue, data: dataCopy }
          }
          return issue
        }) as readonly StandardSchemaV1.Issue[]
      }

      if (schema['~standard'].vendor === 'valibot' && target in RESTRICTED_DATA_FIELDS) {
        const restrictedFields =
          RESTRICTED_DATA_FIELDS[target as keyof typeof RESTRICTED_DATA_FIELDS] || []

        processedIssues = result.issues.map((issue) => {
          if (
            issue &&
            typeof issue === 'object' &&
            'path' in issue &&
            Array.isArray(issue.path)
          ) {
            for (const path of issue.path) {
              if (typeof path === 'object' && 'input' in path && typeof path.input === 'object' && path.input !== null && !Array.isArray(path.input)) {
                for (const field of restrictedFields) {
                  delete path.input[field]
                }
              }
            }
           
          }
          return issue
        }) as readonly StandardSchemaV1.Issue[]
      }

      return c.json({ data: value, error: processedIssues, success: false }, 400)
    }

    return result.value as StandardSchemaV1.InferOutput<Schema>
  })

export type { Hook }
export { sValidator }
