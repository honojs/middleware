import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OpenAPIHono } from '../src/index'
import { toDoc, FileSystem } from '../src/export'

describe('toDoc', () => {
  let app: OpenAPIHono
  let fs: FileSystem

  beforeEach(() => {
    app = new OpenAPIHono()
    fs = {
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    }
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should export OpenAPI document successfully', async () => {
    app.doc('/api-docs', () => ({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    }))

    const result = await toDoc(app, fs)

    expect(result.success).toBe(true)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toBe('./dist/openapi.json')
    expect(fs.mkdir).toHaveBeenCalledWith('./dist', { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(
      './dist/openapi.json',
      expect.any(String)
    )
  })

  it('should export OpenAPI document in YAML format', async () => {
    app.doc('/api-docs', () => ({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    }))

    const result = await toDoc(app, fs, { format: 'yaml' })

    expect(result.success).toBe(true)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toBe('./dist/openapi.yaml')
    expect(fs.mkdir).toHaveBeenCalledWith('./dist', { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(
      './dist/openapi.yaml',
      expect.any(String)
    )
  })

  it('should handle export error', async () => {
    vi.spyOn(app, 'request').mockRejectedValue(new Error('Export error'))

    app.doc('/api-docs', () => ({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    }))

    const result = await toDoc(app, fs)

    expect(result.success).toBe(false)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(0)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('Export error')
  })

  it('should throw error if OpenAPI document endpoint not found', async () => {
    const result = await toDoc(app, fs)

    expect(result.success).toBe(false)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(0)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('OpenAPI document endpoint not found')
 
  })
})