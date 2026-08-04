import { getCodeChallenge } from './getCodeChallenge'
import { getRandomState } from './getRandomState'

describe('getRandomState', () => {
  it('Should not use Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    getRandomState()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('Should draw from crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues')
    getRandomState()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('Should return a fixed-length url-safe string', () => {
    for (let i = 0; i < 100; i++) {
      expect(getRandomState()).toMatch(/^[A-Za-z0-9\-_]{43}$/)
    }
  })

  it('Should not repeat', () => {
    const states = new Set(Array.from({ length: 1000 }, () => getRandomState()))
    expect(states.size).toBe(1000)
  })
})

describe('getCodeChallenge', () => {
  it('Should not use Math.random', async () => {
    const spy = vi.spyOn(Math, 'random')
    await getCodeChallenge()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('Should return a code verifier matching RFC 7636', async () => {
    const { codeVerifier } = await getCodeChallenge()
    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(codeVerifier.length).toBeLessThanOrEqual(128)
  })

  it('Should return the S256 challenge of the verifier', async () => {
    const { codeVerifier, codeChallenge } = await getCodeChallenge()
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(codeChallenge).toBe(expected)
  })

  it('Should not repeat', async () => {
    const challenges = await Promise.all(Array.from({ length: 100 }, () => getCodeChallenge()))
    expect(new Set(challenges.map((c) => c.codeVerifier)).size).toBe(100)
  })
})
