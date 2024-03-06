import { stringify as yamlStringify } from 'yaml'
import type { OpenAPIHono } from './index'

export interface ExportOptions {
  outDir?: string
  format?: 'json' | 'yaml'
  extension?: string
}

export interface FileSystem {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  mkdir(path: string, options: { recursive: boolean }): Promise<void | string>
}

export interface ExportResult {
  success: boolean
  outDir: string
  files: string[]
  error?: Error
}

export const exportDoc = async (
  app: OpenAPIHono,
  fs: FileSystem,
  options: ExportOptions = {}
): Promise<ExportResult> => {
  const { outDir = './dist', format = 'json', extension } = options

  try {
    await fs.mkdir(outDir, { recursive: true })

    const openApiJson = app.getOpenAPIDocument({
      info: {
        title: 'API Document',
        version: '1.0.0',
      },
      openapi: '',
    })

    const ext = getExtension(format, extension)
    const filePath = `${outDir}/openapi${ext}`
    const content = getContent(openApiJson, format)

    await fs.writeFile(filePath, content)

    const result: ExportResult = {
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
  if (extension) {return extension}
  if (format === 'yaml') {return '.yaml'}
  return '.json'
}

const getContent = (openApiJson: unknown, format: string): string =>
  format === 'yaml' ? yamlStringify(openApiJson) : JSON.stringify(openApiJson, null, 2)
