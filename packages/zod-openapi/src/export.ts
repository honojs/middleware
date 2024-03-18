import { stringify as yamlStringify } from 'yaml'
import type { OpenAPIHono } from './index'

export interface ToFilesOptions {
  paths?: string[]
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

const generateFilePath = (basePath: string, docEndpointPath: string, format: string, extension?: string): string => {
  const ext = extension || (format === 'yaml' ? '.yaml' : '.json')
  const sanitizedPath = docEndpointPath.replace(/\//g, '-').replace(/^-*|-*$/g, '')
  return `${basePath}/openapi-${sanitizedPath}${ext}`
}

const fetchAndSaveOpenAPIDocument = async (app: OpenAPIHono, fs: FileSystem, docEndpointPath: string, filePath: string, format: string): Promise<string> => {
  const response = await app.request(`http://localhost${docEndpointPath}`)
  const openApiJson = await response.json()
  const content = getContent(openApiJson, format)
  await fs.writeFile(filePath, content)
  return filePath
}

export const toFiles = async (
  app: OpenAPIHono,
  fs: FileSystem,
  options: ToFilesOptions = {}
): Promise<ToFilesResult> => {
  const { paths, outDir = './dist', format = 'json', extension } = options
  if (!paths || paths.length === 0) {
    return { success: false, outDir, files: [], error: new Error('OpenAPI document endpoints are not specified') }
  }

  await fs.mkdir(outDir, { recursive: true })

  const tasks = paths.map(path => {
    const filePath = generateFilePath(outDir, path, format, extension)
    return fetchAndSaveOpenAPIDocument(app, fs, path, filePath, format)
      .catch(error => ({ error, path }))
  })

  const results = await Promise.all(tasks)
  const filePaths = results.filter(result => typeof result === 'string')
  const errors = results.filter(result => typeof result !== 'string')

  if (errors.length > 0) {
    console.error('Errors occurred:', errors)
  }

  return {
    success: errors.length === 0,
    outDir,
    files: filePaths as string[],
    error: errors.length > 0 ? new Error('Some documents could not be fetched') : undefined
  }
}

const getContent = (openApiJson: unknown, format: string): string =>
  format === 'yaml' ? yamlStringify(openApiJson) : JSON.stringify(openApiJson, null, 2)
