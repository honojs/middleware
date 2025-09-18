import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z as z3 } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { z as z4m } from 'zod/v4-mini'
import { isZod } from './zod-typeguard'

describe('zod-type-guard', () => {
  it('should return true for Zod 3 schema', () => {
    const v3_schema = z3.string()
    expect(isZod(v3_schema)).toBeTruthy()
  })

  it('should return true for Zod 4 schema', () => {
    const v4_schema = z4.string()
    expect(isZod(v4_schema)).toBeTruthy()
  })

  it('should return true for Zod 4 mini', () => {
    const v4m_schema = z4m.string()
    expect(isZod(v4m_schema)).toBeTruthy()
  })

  it('should return false for non-Zod schema', () => {
    expect(isZod(undefined)).toBeFalsy()
    expect(isZod(null)).toBeFalsy()
    expect(isZod('string')).toBeFalsy()
    expect(isZod(123)).toBeFalsy()
    expect(isZod(123n)).toBeFalsy()
    expect(isZod(new Date())).toBeFalsy()
    expect(isZod(Symbol())).toBeFalsy()
    expect(isZod({})).toBeFalsy()
    expect(isZod(() => {})).toBeFalsy()
  })
})
