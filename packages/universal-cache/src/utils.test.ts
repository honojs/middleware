import {
  computeTtlSeconds,
  isExpired,
  isStaleValid,
  normalizePathToName,
  stableStringify,
  toLower,
} from './utils'

describe('utils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('normalizes strings and paths', () => {
    expect(toLower('X-CACHE-KEY')).toBe('x-cache-key')
    expect(normalizePathToName('/')).toBe('root')
    expect(normalizePathToName('/api/items/')).toBe('api:items')
  })

  it('stableStringify handles nullish and primitives', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify(undefined)).toBe('undefined')
    expect(stableStringify(123)).toBe('123')
    expect(stableStringify('abc')).toBe("'abc'")
    expect(stableStringify(true)).toBe('true')
    expect(stableStringify(Number.NaN)).not.toBe(stableStringify(null))
    expect(stableStringify(-0)).not.toBe(stableStringify(0))
  })

  it('stableStringify handles Date, arrays, and sorted object keys', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    expect(stableStringify(date)).not.toBe(stableStringify(date.toISOString()))
    expect(stableStringify([{ b: 2, a: 1 }, 'x'])).toBe(stableStringify([{ a: 1, b: 2 }, 'x']))
    expect(stableStringify({ z: 1, a: { y: 2, x: 1 } })).toBe(
      stableStringify({ a: { x: 1, y: 2 }, z: 1 })
    )
    expect(stableStringify(["a','b"])).not.toBe(stableStringify(['a', 'b']))
  })

  it('stableStringify handles cyclic values', () => {
    const first: { self?: unknown; value: number } = { value: 1 }
    const second: { self?: unknown; value: number } = { value: 1 }
    first.self = first
    second.self = second

    expect(stableStringify(first)).toBe(stableStringify(second))
  })

  it('stableStringify preserves negative zero in maps and floating arrays', () => {
    expect(stableStringify(new Map([['value', 0]]))).not.toBe(
      stableStringify(new Map([['value', -0]]))
    )
    expect(stableStringify(new Map([['value', { nested: 0 }]]))).not.toBe(
      stableStringify(new Map([['value', { nested: -0 }]]))
    )
    expect(stableStringify(new Float64Array([0]))).not.toBe(stableStringify(new Float64Array([-0])))
  })

  it('stableStringify supports cyclic maps', () => {
    const first = new Map<string, unknown>()
    const second = new Map<string, unknown>()
    first.set('self', first)
    second.set('self', second)
    expect(stableStringify(first)).toBe(stableStringify(second))
  })

  it('computes TTL for all branches', () => {
    expect(computeTtlSeconds(0, 30)).toBe(0)
    expect(computeTtlSeconds(-1, 30)).toBe(0)
    expect(computeTtlSeconds(60, -1)).toBeUndefined()
    expect(computeTtlSeconds(60, 0)).toBe(60)
    expect(computeTtlSeconds(60, 30)).toBe(90)
  })

  it('checks expiration and stale validity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const now = Date.now()

    expect(isExpired(now - 1)).toBe(true)
    expect(isExpired(now + 1)).toBe(false)

    expect(isStaleValid(null)).toBe(true)
    expect(isStaleValid(now - 1)).toBe(false)
    expect(isStaleValid(now + 1)).toBe(true)
  })
})
