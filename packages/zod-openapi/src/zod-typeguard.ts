import type { ZodType as ZodTypeV3 } from 'zod/v3'
import type { ZodType as ZodTypeV4 } from 'zod/v4'

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

export function isZod(x: unknown): x is ZodTypeV3 | ZodTypeV4 {
  if (!x) return false
  if (!isObject(x)) return false
  return (
    typeof x.parse === 'function' &&
    typeof x.safeParse === 'function' &&
    typeof x.parseAsync === 'function' &&
    typeof x.safeParseAsync === 'function'
  )
}
