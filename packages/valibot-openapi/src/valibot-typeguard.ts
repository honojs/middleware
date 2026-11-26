import type { GenericSchema } from 'valibot'

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

export function isValibot(x: unknown): x is GenericSchema {
  if (!isObject(x)) {
    return false
  }
  return x.kind === 'schema' && typeof x.type === 'string' && typeof x['~run'] === 'function'
}
