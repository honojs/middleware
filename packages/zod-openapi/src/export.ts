import { stringify as yamlStringify } from 'yaml'
import type { OpenAPIHono } from './index'

export interface ToDocOptions {
  outDir?: string
  format?: 'json' | 'yaml'
  extension?: string
}

export interface FileSystem {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  mkdir(path: string, options: { recursive: boolean }): Promise<void | string>
}

export interface ToDocResult {
  success: boolean
  outDir: string
  files: string[]
  error?: Error
}

export const toDoc = async (
  app: OpenAPIHono,
  fs: FileSystem,
  options: ToDocOptions = {}
): Promise<ToDocResult> => {
  const { outDir = './dist', format = 'json', extension } = options

  try {
    await fs.mkdir(outDir, { recursive: true })

    const docEndpoint = findDocEndpoint(app)
    if (!docEndpoint) {
      throw new Error('OpenAPI document endpoint not found')
    }

    const response = await app.request(`http://localhost${docEndpoint.path}`)
    const openApiJson = await response.json()

    const ext = getExtension(format, extension)
    const filePath = `${outDir}/openapi${ext}`
    const content = getContent(openApiJson, format)

    await fs.writeFile(filePath, content)

    const result: ToDocResult = {
      success: true,
      outDir,
      files: [filePath],
    }

    return result
  } catch (error) {
    return {
      success: false,
      outDir,
      files: [],
      error: error as Error,
    }
  }
}
const getExtension = (format?: string, extension?: string): string => {
  if (extension) {
    return extension
  }
  if (format === 'yaml') {
    return '.yaml'
  }
  return '.json'
}

const getContent = (openApiJson: unknown, format: string): string =>
  format === 'yaml' ? yamlStringify(openApiJson) : JSON.stringify(openApiJson, null, 2)

const docEndpointConditions = ['getOpenAPIDocument', 'getOpenAPI31Document']

const findDocEndpoint = (app: OpenAPIHono) => {
  const docEndpoints = app.routes.filter((route) => {
    const configure = route.handler.toString()
    return docEndpointConditions.some((condition) => configure.includes(condition))
  })

  if (docEndpoints.length === 0) {
    return null
  }

  return {
    path: docEndpoints[0].path,
  }
}
