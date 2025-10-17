import { Ajv } from 'ajv'
import type { JSONSchemaType, ErrorObject } from 'ajv'
import type { Context, Env, MiddlewareHandler, ValidationTargets } from 'hono'
import { validator } from 'hono/validator'

type Hook<T, E extends Env, P extends string> = (
  result: { success: true; data: T } | { success: false; errors: ErrorObject[] },
  c: Context<E, P>
) => Response | Promise<Response> | void

/**
 * Hono middleware that validates incoming data via an Ajv JSON schema.
 *
 * ---
 *
 * No Hook
 *
 * ```ts
 * import { type JSONSchemaType } from 'ajv';
 * import { ajvValidator } from '@hono/ajv-validator';
 *
 * const schema: JSONSchemaType<{ name: string; age: number }> = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name', 'age'],
 *   additionalProperties: false,
 * };
 *
 * const route = app.post('/user', ajvValidator('json', schema), (c) => {
 *   const user = c.req.valid('json');
 *   return c.json({ success: true, message: `${user.name} is ${user.age}` });
 * });
 * ```
 *
 * ---
 * Hook
 *
 * ```ts
 * import { type JSONSchemaType } from 'ajv';
 * import { ajvValidator } from '@hono/ajv-validator';
 *
 * const schema: JSONSchemaType<{ name: string; age: number }> = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name', 'age'],
 *   additionalProperties: false,
 * };
 *
 * app.post(
 *   '/user',
 *   ajvValidator('json', schema, (result, c) => {
 *     if (!result.success) {
 *       return c.text('Invalid!', 400);
 *     }
 *   })
 *   //...
 * );
 * ```
 */
export function ajvValidator<
  T,
  Target extends keyof ValidationTargets,
  E extends Env = Env,
  P extends string = string,
>(
  target: Target,
  schema: JSONSchemaType<T>,
  hook?: Hook<T, E, P>
): MiddlewareHandler<
  E,
  P,
  {
    in: { [K in Target]: T }
    out: { [K in Target]: T }
  }
> {
  const ajv = new Ajv()
  const validate = ajv.compile(schema)

  return validator(target, (data, c) => {
    const valid = validate(data)
    if (valid) {
      if (hook) {
        const hookResult = hook({ success: true, data: data as T }, c)
        if (hookResult) {
          return hookResult
        }
      }
      return data
    }

    const errors = validate.errors || []
    if (hook) {
      const hookResult = hook({ success: false, errors }, c)
      if (hookResult) {
        return hookResult
      }
    }
    return c.json({ success: false, errors }, 400)
  })
}
