import { stringify as yamlStringify } from 'yaml'
import type { OpenAPIHono } from './index'

export interface ToFilesOptions {
  routes?: string[]
  outDir?: string
  format?: 'json' | 'yaml'
  extension?: string
}

export interface FileSystem {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  mkdir(path: string, options: { recursive: boolean }): Promise<void | string>
}

export interface ToFilesResult {
  success: boolean
  outDir: string
  files: string[]
  error?: Error
}

export const ToFiles = async (
  app: OpenAPIHono,
  fs: FileSystem,
  options: ToFilesOptions = {}
): Promise<ToFilesResult> => {
  const { routes, outDir = './dist', format = 'json', extension } = options
  const filePaths: string[] = []

  try {
    await fs.mkdir(outDir, { recursive: true })

    if (!routes || routes.length === 0) {
      throw new Error('OpenAPI document endpoints are not specified')
    }

    await Promise.all(routes.map(async (docEndpointPath) => {
      const response = await app.request(`http://localhost${docEndpointPath}`)
      const openApiJson = await response.json()
  
      const ext = getExtension(format, extension)
      const filePath = `${outDir}/openapi-${docEndpointPath.replace(/\//g, '-')}${ext}`
      const content = getContent(openApiJson, format)
  
      await fs.writeFile(filePath, content)
      filePaths.push(filePath)
    }))

    return {
      success: true,
      outDir,
      files: filePaths,
    }
  } catch (error) {
    return {
      success: false,
      outDir,
      files: [],
      error: error as Error,
    };
  }
};

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
