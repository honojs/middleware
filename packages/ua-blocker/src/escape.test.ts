import { __test } from './escape'

const { $escape } = __test

describe('$escape polyfill', () => {
  it('Should escape regex syntax characters', () => {
    expect($escape('$()*+./?[]^{|}')).toBe('\\$\\(\\)\\*\\+\\.\\/\\?\\[\\]\\^\\{\\|\\}')
  })

  it('Should match the escaped string literally', () => {
    const userAgent = 'Mozilla/5.0 (compatible; BadBot/1.0; +https://example.com/bot)'
    const regex = new RegExp(`(${$escape(userAgent)})`)

    expect(regex.test(userAgent)).toBe(true)
    expect(regex.test('Mozilla/5x0 compatible; BadBot/1x0; https://example.com/bot')).toBe(false)
  })

  it('Should produce a valid pattern for repeated quantifier characters', () => {
    expect(() => new RegExp($escape('C++Bot'))).not.toThrow()
    expect(new RegExp($escape('C++Bot')).test('C++Bot')).toBe(true)
  })
})
