import { describe, it, expect } from 'vitest'
import { normalizeBasePath } from './client'

describe('normalizeBasePath', () => {
  it('should split absolute http URL into baseUrl and basePath', () => {
    const result = normalizeBasePath({ baseUrl: '', basePath: 'http://localhost:8000/api/auth' })
    expect(result.baseUrl).toBe('http://localhost:8000')
    expect(result.basePath).toBe('/api/auth')
    expect(`${result.baseUrl}${result.basePath}/session`).toBe('http://localhost:8000/api/auth/session')
  })

  it('should split absolute https URL into baseUrl and basePath', () => {
    const result = normalizeBasePath({ baseUrl: '', basePath: 'https://example.com/auth' })
    expect(result.baseUrl).toBe('https://example.com')
    expect(result.basePath).toBe('/auth')
    expect(`${result.baseUrl}${result.basePath}/session`).toBe('https://example.com/auth/session')
  })

  it('should not modify relative basePath', () => {
    const result = normalizeBasePath({ baseUrl: 'http://localhost:3000', basePath: '/custom/auth' })
    expect(result.baseUrl).toBe('http://localhost:3000')
    expect(result.basePath).toBe('/custom/auth')
    expect(`${result.baseUrl}${result.basePath}/session`).toBe('http://localhost:3000/custom/auth/session')
  })

  it('should handle absolute URL without path', () => {
    const result = normalizeBasePath({ baseUrl: '', basePath: 'http://localhost:8000' })
    expect(result.baseUrl).toBe('http://localhost:8000')
    expect(result.basePath).toBe('')
    expect(`${result.baseUrl}${result.basePath}/session`).toBe('http://localhost:8000/session')
  })

  it('should override baseUrl when both are absolute URLs', () => {
    const result = normalizeBasePath({ baseUrl: 'http://localhost:3000', basePath: 'http://localhost:8000/api/auth' })
    expect(result.baseUrl).toBe('http://localhost:8000')
    expect(result.basePath).toBe('/api/auth')
    expect(`${result.baseUrl}${result.basePath}/session`).toBe('http://localhost:8000/api/auth/session')
  })

  it('should handle absolute URL with trailing slash', () => {
    const result = normalizeBasePath({ baseUrl: '', basePath: 'http://localhost:8000/api/auth/' })
    expect(result.baseUrl).toBe('http://localhost:8000')
    expect(result.basePath).toBe('/api/auth')
    expect(`${result.baseUrl}${result.basePath}/session`).toBe('http://localhost:8000/api/auth/session')
  })
})
