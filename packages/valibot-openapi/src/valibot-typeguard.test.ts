import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { isValibot } from './valibot-typeguard'

describe('valibot-type-guard', () => {
  it('should return true for a valibot schema', () => {
    expect(isValibot(v.string())).toBeTruthy()
    expect(isValibot(v.object({ id: v.number() }))).toBeTruthy()
    expect(isValibot(v.pipe(v.string(), v.minLength(1)))).toBeTruthy()
    expect(isValibot(v.optional(v.string()))).toBeTruthy()
    expect(isValibot(v.custom<unknown>(() => true))).toBeTruthy()
  })

  it('should return false for a raw OpenAPI schema object', () => {
    expect(isValibot({ type: 'object' })).toBeFalsy()
    expect(isValibot({ $ref: '#/components/schemas/User' })).toBeFalsy()
  })

  it('should return false for non-valibot values', () => {
    expect(isValibot(undefined)).toBeFalsy()
    expect(isValibot(null)).toBeFalsy()
    expect(isValibot('string')).toBeFalsy()
    expect(isValibot(123)).toBeFalsy()
    expect(isValibot(123n)).toBeFalsy()
    expect(isValibot(new Date())).toBeFalsy()
    expect(isValibot(Symbol())).toBeFalsy()
    expect(isValibot({})).toBeFalsy()
    expect(isValibot(() => {})).toBeFalsy()
    // A metadata action is a pipe item, not a schema
    expect(isValibot(v.minLength(1))).toBeFalsy()
  })
})
