import { describe, expect, it } from 'vitest'

import {
  compact,
  componentRef,
  enumInfo,
  isEqual,
  isReferenceObject,
  omitBy,
  parameterRef,
  schemaRef,
  sortObjectByKeys,
  uniq,
} from './index'

describe('isEqual', () => {
  it('compares structurally, key order aside', () => {
    expect(isEqual({ a: [1, { b: 'x' }], c: null }, { c: null, a: [1, { b: 'x' }] })).toBe(true)
    expect(isEqual('a', 'a')).toBe(true)
  })

  it('tells apart different lengths, keys, types and null', () => {
    expect(isEqual([1, 2], [1])).toBe(false)
    expect(isEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(isEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(isEqual([], {})).toBe(false)
    expect(isEqual(null, {})).toBe(false)
    expect(isEqual(1, '1')).toBe(false)
  })
})

describe('collections', () => {
  it('uniq keeps the first of structurally equal values', () => {
    expect(uniq([{ type: 'string' }, { type: 'number' }, { type: 'string' }])).toStrictEqual([
      { type: 'string' },
      { type: 'number' },
    ])
  })

  it('omitBy drops entries by value and key, compact drops undefined', () => {
    expect(
      omitBy(
        { a: 1, b: undefined, param: 2 },
        (value, key) => key === 'param' || value === undefined
      )
    ).toStrictEqual({ a: 1 })
    expect(compact([1, undefined, 2])).toStrictEqual([1, 2])
  })

  it('sortObjectByKeys returns a new sorted record', () => {
    const input = { b: 1, a: 2 }
    expect(Object.keys(sortObjectByKeys(input))).toStrictEqual(['a', 'b'])
    expect(Object.keys(input)).toStrictEqual(['b', 'a'])
  })

  it('enumInfo classifies string, numeric, mixed and empty value lists', () => {
    expect(enumInfo(['a', 'b'])).toStrictEqual({ values: ['a', 'b'], type: 'string' })
    expect(enumInfo([1, 2])).toStrictEqual({ values: [1, 2], type: 'numeric' })
    expect(enumInfo(['a', 1])).toStrictEqual({ values: ['a', 1], type: 'mixed' })
    expect(enumInfo([])).toStrictEqual({ values: [], type: 'string' })
  })
})

describe('references', () => {
  it('builds component pointers', () => {
    expect(schemaRef('User')).toBe('#/components/schemas/User')
    expect(parameterRef('Id')).toBe('#/components/parameters/Id')
    expect(componentRef('securitySchemes', 'bearer')).toBe('#/components/securitySchemes/bearer')
  })

  it('recognizes reference objects by a string $ref', () => {
    expect(isReferenceObject({ $ref: '#/x' })).toBe(true)
    expect(isReferenceObject({ $ref: 1 })).toBe(false)
    expect(isReferenceObject({ type: 'string' })).toBe(false)
  })
})
