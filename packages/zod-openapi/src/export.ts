import type { OpenAPIHono } from './index'
import { stringify as yamlStringify } from 'yaml'

export interface ExportOptions {
  outDir?: string
  format?: 'json' | 'yaml'
  extension?: string
  beforeRequestHook?: BeforeRequestHook
  afterResponseHook?: AfterResponseHook
  afterExportHook?: AfterExportHook
}

export interface FileSystem {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  mkdir(path: string, options: { recursive: boolean }): Promise<void | string>
}

export type BeforeRequestHook = (req: Request) => Request | false
export type AfterResponseHook = (res: Response) => Response | false
export type AfterExportHook = (result: ExportResult) => void | Promise<void>

export interface ExportResult {
  success: boolean
  outDir: string
  files: string[]
  error?: Error
}

export async function exportOpenAPI(
  app: OpenAPIHono,
  fs: FileSystem,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const { outDir = './dist', format = 'json', extension } = options

  try {
    await fs.mkdir(outDir, { recursive: true })

    const files: string[] = []

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
    files.push(filePath)

    const result: ExportResult = {
      success: true,
      outDir,
      files,
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

function getExtension(format?: string, extension?: string): string {
  if (extension) return extension
  if (format === 'yaml') return '.yaml'
  return '.json'
}

function getContent(openApiJson: unknown, format: string): string {
  if (format === 'yaml') {
    return yamlStringify(openApiJson)
  } else {
    return JSON.stringify(openApiJson, null, 2)
  }
}