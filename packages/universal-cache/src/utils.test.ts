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
    expect(stableStringify('abc')).toBe('"abc"')
    expect(stableStringify(true)).toBe('true')
  })

  it('stableStringify handles Date, arrays, and sorted object keys', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    expect(stableStringify(date)).toBe('"2026-01-01T00:00:00.000Z"')

    expect(stableStringify([{ b: 2, a: 1 }, 'x'])).toBe('[{"a":1,"b":2},"x"]')
    expect(stableStringify({ z: 1, a: { y: 2, x: 1 } })).toBe('{"a":{"x":1,"y":2},"z":1}')
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
