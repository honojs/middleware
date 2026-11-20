import { describe, expect, it } from 'vitest'

import { generateComponents, generateDocument } from './index'
import * as v from './index'

describe('primitives', () => {
  it('maps primitive schemas', () => {
    const result = generateComponents(
      [
        v.pipe(
          v.object({
            s: v.string(),
            n: v.number(),
            b: v.boolean(),
            big: v.bigint(),
            u: v.unknown(),
            a: v.any(),
            d: v.date(),
            nul: v.null(),
          }),
          v.openapi('P')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      P: {
        type: 'object',
        properties: {
          s: { type: 'string' },
          n: { type: 'number' },
          b: { type: 'boolean' },
          big: { type: 'string', pattern: '^\\d+$' },
          u: { nullable: true },
          a: { nullable: true },
          d: { type: 'string', format: 'date-time' },
          nul: { nullable: true },
        },
        required: ['s', 'n', 'b', 'big', 'd', 'nul'],
      },
    })
  })

  it('maps string validations to format / pattern / length', () => {
    const result = generateComponents(
      [
        v.pipe(
          v.object({
            email: v.pipe(v.string(), v.email()),
            uuid: v.pipe(v.string(), v.uuid()),
            url: v.pipe(v.string(), v.url()),
            iso: v.pipe(v.string(), v.isoDateTime()),
            len: v.pipe(v.string(), v.minLength(1), v.maxLength(3)),
            exact: v.pipe(v.string(), v.length(2)),
            re: v.pipe(v.string(), v.regex(/^a+$/u)),
          }),
          v.openapi('S')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      S: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          uuid: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          iso: { type: 'string', format: 'date-time' },
          len: { type: 'string', minLength: 1, maxLength: 3 },
          exact: { type: 'string', minLength: 2, maxLength: 2 },
          re: { type: 'string', pattern: '^a+$' },
        },
        required: ['email', 'uuid', 'url', 'iso', 'len', 'exact', 're'],
      },
    })
  })

  it('maps number validations per version', () => {
    const N = v.pipe(v.number(), v.gtValue(1), v.maxValue(10), v.multipleOf(2), v.openapi('N'))
    const result = generateComponents([N], { openapi: '3.0.0' })
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      N: { type: 'number', minimum: 1, exclusiveMinimum: true, maximum: 10, multipleOf: 2 },
    })
    const result2 = generateComponents([N], { openapi: '3.1.0' })
    expect(result2.ok ? result2.value.components?.schemas : result2).toStrictEqual({
      N: { type: 'number', exclusiveMinimum: 1, maximum: 10, multipleOf: 2 },
    })
    const result3 = generateComponents([v.pipe(v.number(), v.integer(), v.openapi('I'))], {
      openapi: '3.0.0',
    })
    expect(result3.ok ? result3.value.components?.schemas : result3).toStrictEqual({
      I: { type: 'integer' },
    })
  })

  it('keeps title / description / examples / metadata actions', () => {
    const result = generateComponents(
      [
        v.pipe(
          v.string(),
          v.title('T'),
          v.description('D'),
          v.examples(['a']),
          v.metadata({ deprecated: true }),
          v.openapi('S')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      S: { type: 'string', title: 'T', description: 'D', examples: ['a'], deprecated: true },
    })
  })

  it('reports schemas without a JSON representation unless a type is given', () => {
    const unsupported = generateComponents([v.pipe(v.symbol(), v.openapi('X'))], {
      openapi: '3.0.0',
    })
    expect(unsupported.ok ? unsupported : unsupported.error.type).toBe('UnknownSchemaTypeError')
    expect(unsupported.ok ? unsupported : unsupported.error.message).toBe(
      'Unknown valibot schema type `symbol`, please specify `type` and other OpenAPI props using `openapi()`.'
    )
    const result = generateComponents([v.pipe(v.symbol(), v.openapi('X', { type: 'string' }))], {
      openapi: '3.0.0',
    })
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      X: { type: 'string' },
    })
  })
})

describe('literals and enums', () => {
  it('maps literals, picklists and TypeScript enums', () => {
    enum Role {
      Admin = 'admin',
      User = 'user',
    }
    const result = generateComponents(
      [
        v.pipe(
          v.object({
            one: v.literal('a'),
            many: v.picklist(['a', 'b']),
            numbers: v.picklist([1, 2]),
            role: v.enum(Role),
            flag: v.literal(true),
            nullable: v.nullable(v.picklist(['x', 'y'])),
          }),
          v.openapi('L')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      L: {
        type: 'object',
        properties: {
          one: { type: 'string', enum: ['a'] },
          many: { type: 'string', enum: ['a', 'b'] },
          numbers: { type: 'integer', enum: [1, 2] },
          role: { type: 'string', enum: ['admin', 'user'] },
          flag: { type: 'boolean', enum: [true] },
          nullable: { type: 'string', enum: ['x', 'y', null], nullable: true },
        },
        required: ['one', 'many', 'numbers', 'role', 'flag', 'nullable'],
      },
    })
  })
})

describe('arrays and tuples', () => {
  it('maps arrays, non-empty arrays and tuples', () => {
    const T = v.pipe(
      v.object({
        list: v.array(v.string()),
        nonEmpty: v.pipe(v.array(v.number()), v.nonEmpty()),
        bounded: v.pipe(v.array(v.number()), v.minLength(1), v.maxLength(3)),
        tuple: v.tuple([v.string(), v.number()]),
        rest: v.tupleWithRest([v.string()], v.boolean()),
      }),
      v.openapi('A')
    )
    const result = generateComponents([T], { openapi: '3.0.0' })
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      A: {
        type: 'object',
        properties: {
          list: { type: 'array', items: { type: 'string' } },
          nonEmpty: { type: 'array', items: { type: 'number' }, minItems: 1 },
          bounded: { type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 3 },
          tuple: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
            minItems: 2,
            maxItems: 2,
          },
          rest: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
            minItems: 1,
          },
        },
        required: ['list', 'nonEmpty', 'bounded', 'tuple', 'rest'],
      },
    })
    const result2 = generateComponents([T], { openapi: '3.1.0' })
    expect(
      result2.ok
        ? (result2.value.components?.schemas?.A as { properties?: unknown } | undefined)?.properties
        : result2
    ).toStrictEqual({
      list: { type: 'array', items: { type: 'string' } },
      nonEmpty: { type: 'array', items: { type: 'number' }, minItems: 1 },
      bounded: { type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 3 },
      tuple: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }] },
      rest: { type: 'array', prefixItems: [{ type: 'string' }], items: { type: 'boolean' } },
    })
  })
})

describe('objects and records', () => {
  it('maps optional, nullish and defaulted fields', () => {
    const result = generateComponents(
      [
        v.pipe(
          v.object({
            a: v.optional(v.string()),
            b: v.nullish(v.string()),
            c: v.optional(v.number(), () => 1),
            d: v.exactOptional(v.string()),
            e: v.undefinedable(v.string()),
          }),
          v.openapi('O')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      O: {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'string', nullable: true },
          c: { type: 'number', default: 1 },
          d: { type: 'string' },
          e: { type: 'string' },
        },
      },
    })
  })

  it('maps strict / loose objects, records and intersections', () => {
    const Base = v.pipe(v.object({ id: v.string() }), v.openapi('Base'))
    const result = generateComponents(
      [
        Base,
        v.pipe(
          v.object({
            strict: v.strictObject({ a: v.string() }),
            loose: v.looseObject({ a: v.string() }),
            rest: v.objectWithRest({ a: v.string() }, v.number()),
            dict: v.record(v.string(), v.number()),
            extended: v.intersect([Base, v.object({ extra: v.string() })]),
          }),
          v.openapi('R')
        ),
      ],
      { openapi: '3.0.0' }
    )
    expect(result.ok ? result.value.components?.schemas?.R : result).toStrictEqual({
      type: 'object',
      properties: {
        strict: {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
          additionalProperties: false,
        },
        loose: {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
          additionalProperties: true,
        },
        rest: {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
          additionalProperties: { type: 'number' },
        },
        dict: { type: 'object', additionalProperties: { type: 'number' } },
        extended: {
          allOf: [
            { $ref: '#/components/schemas/Base' },
            {
              type: 'object',
              properties: { extra: { type: 'string' } },
              required: ['extra'],
            },
          ],
        },
      },
      required: ['strict', 'loose', 'rest', 'dict', 'extended'],
    })
  })

  it('maps lazy schemas through their refId', () => {
    type Node = { readonly children: readonly Node[] }
    const Node: v.GenericSchema<Node> = v.pipe(
      v.object({ children: v.array(v.lazy(() => Node)) }),
      v.openapi('Node')
    )
    const result = generateComponents([Node], { openapi: '3.0.0' })
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      Node: {
        type: 'object',
        properties: {
          children: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
        },
        required: ['children'],
      },
    })
  })
})

describe('unions', () => {
  it('maps plain unions, nullable unions and the preferred type', () => {
    const U = v.union([v.string(), v.number()])
    const result = generateComponents([v.pipe(U, v.openapi('U'))], { openapi: '3.0.0' })
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      U: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    })
    const result2 = generateComponents([v.pipe(v.nullable(U), v.openapi('N'))], {
      openapi: '3.1.0',
    })
    expect(result2.ok ? result2.value.components?.schemas : result2).toStrictEqual({
      N: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
    })
    const result3 = generateComponents(
      [v.pipe(U, v.openapi('O', {}, { unionPreferredType: 'oneOf' }))],
      {
        openapi: '3.0.0',
      }
    )
    expect(result3.ok ? result3.value.components?.schemas : result3).toStrictEqual({
      O: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    })
  })

  it('maps variants of registered objects to oneOf + discriminator', () => {
    const Cat = v.pipe(v.object({ kind: v.literal('cat'), lives: v.number() }), v.openapi('Cat'))
    const Dog = v.pipe(v.object({ kind: v.literal('dog'), barks: v.boolean() }), v.openapi('Dog'))
    const result = generateComponents([v.pipe(v.variant('kind', [Cat, Dog]), v.openapi('Pet'))], {
      openapi: '3.0.0',
    })
    expect(result.ok ? result.value.components?.schemas?.Pet : result).toStrictEqual({
      oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }],
      discriminator: {
        propertyName: 'kind',
        mapping: { cat: '#/components/schemas/Cat', dog: '#/components/schemas/Dog' },
      },
    })
  })

  it('registers nullable references through allOf per version', () => {
    const S = v.pipe(v.string(), v.openapi('S'))
    const result = generateComponents(
      [S, v.pipe(v.object({ key: v.nullable(S) }), v.openapi('T'))],
      {
        openapi: '3.0.0',
      }
    )
    expect(result.ok ? result.value.components?.schemas : result).toStrictEqual({
      S: { type: 'string' },
      T: {
        type: 'object',
        properties: { key: { allOf: [{ $ref: '#/components/schemas/S' }, { nullable: true }] } },
        required: ['key'],
      },
    })
    const result2 = generateComponents(
      [S, v.pipe(v.object({ key: v.nullable(S) }), v.openapi('T'))],
      {
        openapi: '3.1.0',
      }
    )
    expect(
      result2.ok
        ? (result2.value.components?.schemas?.T as { properties?: unknown } | undefined)?.properties
        : result2
    ).toStrictEqual({
      key: { allOf: [{ $ref: '#/components/schemas/S' }, { type: ['string', 'null'] }] },
    })
  })
})

describe('error propagation', () => {
  it('propagates schema errors out of every container', () => {
    const containers = [
      v.object({ x: v.symbol() }),
      v.array(v.symbol()),
      v.set(v.symbol()),
      v.tuple([v.string(), v.symbol()]),
      v.tupleWithRest([v.string()], v.symbol()),
      v.union([v.object({ x: v.string() }), v.object({ x: v.symbol() })]),
      v.record(v.string(), v.symbol()),
      v.objectWithRest({ a: v.string() }, v.symbol()),
      v.intersect([v.object({ a: v.string() }), v.object({ b: v.symbol() })]),
      v.variant('kind', [v.object({ kind: v.literal('a'), x: v.symbol() })]),
      v.nullable(v.object({ x: v.symbol() })),
      v.lazy(() => v.object({ x: v.symbol() })),
    ]
    for (const container of containers) {
      const result = generateComponents([v.pipe(container, v.openapi('C'))], {
        openapi: '3.0.0',
      })
      expect(result.ok ? result : result.error.type).toBe('UnknownSchemaTypeError')
    }
  })

  it('propagates schema errors out of routes', () => {
    const responsesOnly = { 200: { description: 'OK' } }
    const routes = [
      {
        method: 'get',
        path: '/',
        request: { body: { content: { 'application/json': { schema: v.symbol() } } } },
        responses: responsesOnly,
      },
      {
        method: 'get',
        path: '/',
        request: { params: v.object({ id: v.symbol() }) },
        responses: responsesOnly,
      },
      {
        method: 'get',
        path: '/',
        request: { headers: [v.object({ 'x-a': v.symbol() })] },
        responses: responsesOnly,
      },
      {
        method: 'get',
        path: '/',
        responses: {
          200: {
            description: 'OK',
            headers: v.object({ 'x-a': v.symbol() }),
            content: { 'application/json': { schema: v.symbol() } },
          },
        },
      },
      {
        method: 'query',
        path: '/',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/jsonl': { itemSchema: v.symbol() } },
          },
        },
      },
    ] as const
    for (const route of routes) {
      const result = generateDocument([{ type: 'route', route }], {
        openapi: '3.2.0',
        info: { title: 'API', version: '1.0.0' },
      })
      expect(result.ok ? result : result.error.type).toBe('UnknownSchemaTypeError')
    }
  })

  it('propagates schema errors out of registered parameters and webhooks', () => {
    const parameter = generateDocument(
      [
        {
          type: 'parameter',
          schema: v.pipe(v.symbol(), v.openapi({ param: { name: 'p', in: 'query' } })),
        },
      ],
      { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } }
    )
    expect(parameter.ok ? parameter : parameter.error.type).toBe('UnknownSchemaTypeError')
    const webhook = generateDocument(
      [
        {
          type: 'webhook',
          webhook: {
            method: 'post',
            path: 'created',
            request: { body: { content: { 'application/json': { schema: v.symbol() } } } },
            responses: { 200: { description: 'OK' } },
          },
        },
      ],
      { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } }
    )
    expect(webhook.ok ? webhook : webhook.error.type).toBe('UnknownSchemaTypeError')
  })
})
