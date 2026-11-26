import { describe, expect, it } from 'vitest'

import * as v from '../index'
import { getInternalMetadata, getOpenApiMetadata, getParamMetadata, getRefId } from './index'

describe('openapi()', () => {
  it('distinguishes the refId form from the metadata form', () => {
    const byRef = v.pipe(v.string(), v.openapi('Id'))
    expect(getRefId(byRef)).toBe('Id')
    expect(getOpenApiMetadata(byRef)).toStrictEqual({})

    const byMetadata = v.pipe(v.string(), v.openapi({ description: 'D' }))
    expect(getRefId(byMetadata)).toBeUndefined()
    expect(getOpenApiMetadata(byMetadata)).toStrictEqual({ description: 'D' })

    const full = v.pipe(
      v.union([v.string(), v.number()]),
      v.openapi('U', { description: 'D' }, { unionPreferredType: 'oneOf' })
    )
    expect(getInternalMetadata(full)).toStrictEqual({ refId: 'U', unionPreferredType: 'oneOf' })
    expect(getOpenApiMetadata(full)).toStrictEqual({ description: 'D' })
  })

  it('drops undefined values', () => {
    expect(
      getOpenApiMetadata(v.pipe(v.string(), v.openapi({ description: undefined, example: 'x' })))
    ).toStrictEqual({ example: 'x' })
  })
})

describe('precedence', () => {
  it('lets the later action of a pipe win, whichever kind it is', () => {
    expect(
      getOpenApiMetadata(v.pipe(v.string(), v.description('a'), v.openapi({ description: 'b' })))
    ).toStrictEqual({ description: 'b' })
    expect(
      getOpenApiMetadata(v.pipe(v.string(), v.openapi({ description: 'b' }), v.description('a')))
    ).toStrictEqual({ description: 'a' })
  })

  it('lets an outer wrapper override the wrapped schema and merges param across layers', () => {
    const inner = v.pipe(
      v.string(),
      v.openapi({ description: 'inner', example: 'a', param: { name: 'n' } })
    )
    const outer = v.pipe(
      v.optional(inner),
      v.openapi({ description: 'outer', param: { in: 'query' } })
    )
    expect(getOpenApiMetadata(outer)).toStrictEqual({
      description: 'outer',
      example: 'a',
      param: { name: 'n', in: 'query' },
    })
    expect(getRefId(v.nullable(v.pipe(v.string(), v.openapi('Id'))))).toBe('Id')
  })

  it('falls back to the schema description for parameters, param.description first', () => {
    expect(
      getParamMetadata(v.pipe(v.string(), v.openapi({ description: 'S' }))).param
    ).toStrictEqual({
      description: 'S',
    })
    expect(
      getParamMetadata(
        v.pipe(v.string(), v.openapi({ description: 'S', param: { description: 'P' } }))
      ).param
    ).toStrictEqual({ description: 'P' })
  })
})
