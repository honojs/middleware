import { describe, expect, it } from 'vitest'

import { generateComponents } from './index'
import * as v from './index'

// Registers `schema` as `X` and returns the generated component — or the error result.
const schemaOf = (
  schema: v.GenericSchema,
  openapi: '3.0.0' | '3.1.0' = '3.0.0',
  options?: v.GeneratorOptions
) => {
  const result = generateComponents([v.pipe(schema, v.openapi('X'))], { openapi }, options)
  return result.ok ? result.value.components?.schemas?.X : result
}

describe('literals and enums', () => {
  it('maps a bigint literal like v.bigint()', () => {
    expect(schemaOf(v.literal(10n))).toStrictEqual({ type: 'string', pattern: '^\\d+$' })
  })

  it('rejects a picklist that mixes strings and numbers', () => {
    expect(schemaOf(v.picklist(['a', 1]))).toStrictEqual({
      ok: false,
      error: {
        type: 'ValibotToOpenAPIError',
        message:
          'Enum has mixed string and number values, please specify the OpenAPI type manually using `openapi({ type })`',
      },
    })
  })
})

describe('strings', () => {
  it('maps every format validation to its OpenAPI format', () => {
    const formats = [
      [v.pipe(v.string(), v.isoDate()), 'date'],
      [v.pipe(v.string(), v.isoTime()), 'time'],
      [v.pipe(v.string(), v.isoTimeSecond()), 'time'],
      [v.pipe(v.string(), v.isoTimestamp()), 'date-time'],
      [v.pipe(v.string(), v.rfcEmail()), 'email'],
      [v.pipe(v.string(), v.ipv4()), 'ipv4'],
      [v.pipe(v.string(), v.ipv6()), 'ipv6'],
      [v.pipe(v.string(), v.ip()), 'ip'],
      [v.pipe(v.string(), v.base64()), 'byte'],
      [v.pipe(v.string(), v.decimal()), 'decimal'],
      [v.pipe(v.string(), v.cuid2()), 'cuid2'],
      [v.pipe(v.string(), v.ulid()), 'ulid'],
      [v.pipe(v.string(), v.nanoid()), 'nanoid'],
      [v.pipe(v.string(), v.emoji()), 'emoji'],
    ] as const
    for (const [schema, format] of formats) {
      expect(schemaOf(schema)).toStrictEqual({ type: 'string', format })
    }
  })

  it('keeps the first format when several validations declare one', () => {
    expect(schemaOf(v.pipe(v.string(), v.email(), v.uuid()))).toStrictEqual({
      type: 'string',
      format: 'email',
    })
  })

  it('maps nonEmpty to minLength 1 unless an explicit minLength is given', () => {
    expect(schemaOf(v.pipe(v.string(), v.nonEmpty()))).toStrictEqual({
      type: 'string',
      minLength: 1,
    })
    expect(schemaOf(v.pipe(v.string(), v.nonEmpty(), v.minLength(3)))).toStrictEqual({
      type: 'string',
      minLength: 3,
    })
  })
})

describe('numbers', () => {
  it('maps minValue / ltValue / safeInteger per version', () => {
    const N = v.pipe(v.number(), v.minValue(1), v.ltValue(5), v.safeInteger())
    expect(schemaOf(N)).toStrictEqual({
      type: 'integer',
      minimum: 1,
      maximum: 5,
      exclusiveMaximum: true,
    })
    expect(schemaOf(N, '3.1.0')).toStrictEqual({ type: 'integer', minimum: 1, exclusiveMaximum: 5 })
  })
})

describe('arrays, sets and tuples', () => {
  it('maps sets to unique arrays with size bounds', () => {
    expect(schemaOf(v.pipe(v.set(v.string()), v.minSize(1), v.maxSize(3)))).toStrictEqual({
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
      minItems: 1,
      maxItems: 3,
    })
  })

  it('collapses same-typed tuple items into a single 3.0 items schema', () => {
    expect(schemaOf(v.tuple([v.string(), v.string()]))).toStrictEqual({
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    })
  })
})

describe('pipes and defaults', () => {
  it('ignores validations placed after a transformation', () => {
    expect(
      schemaOf(v.pipe(v.string(), v.minLength(1), v.transform(Number), v.minValue(1)))
    ).toStrictEqual({ type: 'string', minLength: 1 })
  })

  it('flattens nested pipes in declaration order', () => {
    expect(schemaOf(v.pipe(v.pipe(v.string(), v.minLength(1)), v.maxLength(5)))).toStrictEqual({
      type: 'string',
      minLength: 1,
      maxLength: 5,
    })
  })

  it('takes the default from the outermost wrapper that declares one, null included', () => {
    expect(
      schemaOf(
        v.object({
          a: v.nullish(v.string(), null),
          b: v.nullable(v.optional(v.string(), 'x')),
          c: v.optional(v.object({ k: v.string() }), { k: 'v' }),
        })
      )
    ).toStrictEqual({
      type: 'object',
      properties: {
        a: { type: 'string', nullable: true, default: null },
        b: { type: 'string', nullable: true, default: 'x' },
        c: {
          type: 'object',
          properties: { k: { type: 'string' } },
          default: { k: 'v' },
          required: ['k'],
        },
      },
    })
  })
})

describe('nullability per version', () => {
  it('maps a nullable unknown to nullable-only in 3.0 and to an empty schema in 3.1', () => {
    expect(schemaOf(v.nullable(v.unknown()))).toStrictEqual({ nullable: true })
    expect(schemaOf(v.nullable(v.unknown()), '3.1.0')).toStrictEqual({})
  })

  it('emits an explicit null union member once per version', () => {
    const U = v.union([v.string(), v.null()])
    expect(schemaOf(U)).toStrictEqual({ anyOf: [{ type: 'string' }, { nullable: true }] })
    expect(schemaOf(U, '3.1.0')).toStrictEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] })
  })

  it('hoists a nullable union member to the whole union', () => {
    expect(schemaOf(v.union([v.nullable(v.string()), v.number()]), '3.1.0')).toStrictEqual({
      anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
    })
  })

  it('wraps a nullable intersection in anyOf', () => {
    expect(
      schemaOf(v.nullable(v.intersect([v.object({ a: v.string() }), v.object({ b: v.string() })])))
    ).toStrictEqual({
      anyOf: [
        {
          allOf: [
            { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
            { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] },
          ],
        },
        { nullable: true },
      ],
    })
  })

  it('makes a recursive reference nullable through allOf (3.0) or oneOf (3.1)', () => {
    type Node = { readonly next: Node | null }
    const Node: v.GenericSchema<Node> = v.pipe(
      v.object({ next: v.nullable(v.lazy(() => Node)) }),
      v.openapi('Node')
    )
    const v30 = generateComponents([Node], { openapi: '3.0.0' })
    expect(
      v30.ok
        ? (v30.value.components?.schemas?.Node as { properties?: unknown } | undefined)?.properties
        : v30
    ).toStrictEqual({
      next: { allOf: [{ $ref: '#/components/schemas/Node' }, { nullable: true }] },
    })
    const v31 = generateComponents([Node], { openapi: '3.1.0' })
    expect(
      v31.ok
        ? (v31.value.components?.schemas?.Node as { properties?: unknown } | undefined)?.properties
        : v31
    ).toStrictEqual({
      next: { oneOf: [{ $ref: '#/components/schemas/Node' }, { type: 'null' }] },
    })
  })

  it('adds null to the type array of string-backed schemas in 3.1', () => {
    expect(
      schemaOf(v.object({ d: v.nullable(v.date()), b: v.nullable(v.bigint()) }), '3.1.0')
    ).toStrictEqual({
      type: 'object',
      properties: {
        d: { type: ['string', 'null'], format: 'date-time' },
        b: { type: ['string', 'null'], pattern: '^\\d+$' },
      },
      required: ['d', 'b'],
    })
  })
})

describe('unions', () => {
  it('flattens nested unions, drops undefined members and makes the key optional', () => {
    expect(
      schemaOf(v.object({ a: v.union([v.union([v.string(), v.undefined()]), v.number()]) }))
    ).toStrictEqual({
      type: 'object',
      properties: { a: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
    })
  })

  it('maps a union of only undefined to an unconstrained optional property', () => {
    expect(schemaOf(v.object({ a: v.union([v.undefined()]) }))).toStrictEqual({
      type: 'object',
      properties: { a: {} },
    })
  })

  it('applies the generator-wide unionPreferredType, overridden per schema', () => {
    const U = v.union([v.string(), v.number()])
    expect(schemaOf(U, '3.0.0', { unionPreferredType: 'oneOf' })).toStrictEqual({
      oneOf: [{ type: 'string' }, { type: 'number' }],
    })
    expect(
      schemaOf(v.pipe(U, v.openapi({}, { unionPreferredType: 'anyOf' })), '3.0.0', {
        unionPreferredType: 'oneOf',
      })
    ).toStrictEqual({ anyOf: [{ type: 'string' }, { type: 'number' }] })
  })
})

describe('variants', () => {
  it('drops the discriminator for nullable variants and for unregistered options', () => {
    const inline = { type: 'object', properties: { k: { type: 'string', enum: ['a'] } } }
    expect(schemaOf(v.nullable(v.variant('k', [v.object({ k: v.literal('a') })])))).toStrictEqual({
      oneOf: [{ ...inline, required: ['k'] }, { nullable: true }],
    })
    expect(
      schemaOf(
        v.variant('k', [v.object({ k: v.literal('a') }), v.object({ k: v.picklist(['b', 'c']) })])
      )
    ).toStrictEqual({
      oneOf: [
        { ...inline, required: ['k'] },
        {
          type: 'object',
          properties: { k: { type: 'string', enum: ['b', 'c'] } },
          required: ['k'],
        },
      ],
    })
  })

  it('collects discriminator values through nested variants and picklists', () => {
    const A = v.pipe(v.object({ k: v.literal('a') }), v.openapi('A'))
    const B = v.pipe(v.object({ k: v.picklist(['b', 'c']) }), v.openapi('B'))
    const Inner = v.pipe(v.variant('k', [A, B]), v.openapi('Inner'))
    const C = v.pipe(v.object({ k: v.literal('d') }), v.openapi('C'))
    expect(schemaOf(v.variant('k', [Inner, C]))).toStrictEqual({
      oneOf: [{ $ref: '#/components/schemas/Inner' }, { $ref: '#/components/schemas/C' }],
      discriminator: {
        propertyName: 'k',
        mapping: {
          a: '#/components/schemas/Inner',
          b: '#/components/schemas/Inner',
          c: '#/components/schemas/Inner',
          d: '#/components/schemas/C',
        },
      },
    })
  })
})

describe('objects and records', () => {
  it('expands a picklist record key into fixed properties', () => {
    expect(schemaOf(v.record(v.picklist(['a', 'b']), v.number()))).toStrictEqual({
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
    })
  })

  it('collapses an override equal to the registered schema into a bare $ref', () => {
    const Base = v.pipe(v.string(), v.openapi('Base', { description: 'base' }))
    const result = generateComponents(
      [
        Base,
        v.pipe(
          v.object({
            same: v.pipe(Base, v.openapi({ type: 'string' })),
            nullable: v.nullable(Base),
          }),
          v.openapi('T')
        ),
      ],
      { openapi: '3.1.0' }
    )
    expect(
      result.ok
        ? (result.value.components?.schemas?.T as { properties?: unknown } | undefined)?.properties
        : result
    ).toStrictEqual({
      same: { $ref: '#/components/schemas/Base' },
      nullable: { allOf: [{ $ref: '#/components/schemas/Base' }, { type: ['string', 'null'] }] },
    })
  })
})
