import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OpenAPIHono } from '../src/index'
import { toFiles, FileSystem } from '../src/export'

describe('toFiles', () => {
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

    const result = await toFiles(app, fs, { paths:['/api-docs'] })

    expect(result.success).toBe(true)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toBe('./dist/openapi-api-docs.json')
    expect(fs.mkdir).toHaveBeenCalledWith('./dist', { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(
      './dist/openapi-api-docs.json',
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

    const result = await toFiles(app, fs, { format: 'yaml', paths: ['/api-docs'] })
    const expectedYAMLContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas: {}
  parameters: {}
paths: {}
`
    expect(result.success).toBe(true)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toBe('./dist/openapi-api-docs.yaml')
    expect(fs.mkdir).toHaveBeenCalledWith('./dist', { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(
      './dist/openapi-api-docs.yaml',
      expectedYAMLContent
    )
  })

  it('should export OpenAPI documents in YAML format', async () => {
    app.doc('/api-docs', () => ({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    }))
    app.doc31('/api-docs31', () => ({
      openapi: '3.1.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
    }))

    const result = await toFiles(app, fs, { format: 'yaml', paths: ['/api-docs', '/api-docs31'] })
    const expectedYAMLContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas: {}
  parameters: {}
paths: {}
`
    const expectedYAMLContent31 = `openapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas: {}
  parameters: {}
paths: {}
webhooks: {}
`

    expect(result.files[0]).toBe('./dist/openapi-api-docs.yaml')
    expect(fs.mkdir).toHaveBeenCalledWith('./dist', { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(
      './dist/openapi-api-docs.yaml',
      expectedYAMLContent
    )
    expect(result.files[1]).toBe('./dist/openapi-api-docs31.yaml')
    expect(fs.writeFile).toHaveBeenCalledWith(
      './dist/openapi-api-docs31.yaml',
      expectedYAMLContent31
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

    const result = await toFiles(app, fs)

    expect(result.success).toBe(false)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(0)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('OpenAPI document endpoints are not specified')
  })

  it('should throw error if OpenAPI document endpoint not found', async () => {
    const result = await toFiles(app, fs)

    expect(result.success).toBe(false)
    expect(result.outDir).toBe('./dist')
    expect(result.files).toHaveLength(0)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('OpenAPI document endpoints are not specified')
 
  })
})