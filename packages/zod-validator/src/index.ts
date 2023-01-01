import type { Context } from 'hono'
import { validator } from 'hono/validator'
import type { z } from 'zod'
import type { ZodSchema, ZodError } from 'zod'

type ValidationTypes = 'json' | 'form' | 'query' | 'queries'
type Hook<T> = (
  result: { success: true; data: T } | { success: false; error: ZodError },
  c: Context
) => Response | Promise<Response> | void

export const zValidator = <T extends ZodSchema, Type extends ValidationTypes>(
  type: Type,
  schema: T,
  hook?: Hook<z.infer<T>>
) =>
  validator(type, (value, c) => {
    const result = schema.safeParse(value)

    if (hook) {
      const hookResult = hook(result, c)
      if (hookResult instanceof Response || hookResult instanceof Promise<Response>) {
        return hookResult
      }
    }

    if (!result.success) {
      return c.json(result, 400)
    }

    const data = result.data as z.infer<T>
    return data
  })
