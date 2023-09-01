import path from 'path'
import type { Context, Next } from 'hono'
import { FORM_MIME_TYPES } from './constants'
import type {
  HonoFileUploadAwsOption,
  HonoFileUploadDiskOption,
  HonoFileUploadFirebaseOption,
  HonoFileUploadOption,
} from './types'

export function validateContentType(c: Context, next: Next, options: HonoFileUploadDiskOption) {
  const contentType = c.req.headers.get('Content-Type')

  if (!contentType || options.skipNonFormBody) {
    return next()
  }

  if (FORM_MIME_TYPES.every((type) => !contentType.startsWith(type))) {
    throw new Error(`Content-Type must be ${FORM_MIME_TYPES.join(' or ')}`)
  }
}

export async function getFiles(c: Context, options: HonoFileUploadDiskOption) {
  const form = await c.req.parseBody()
  const files = Object.entries(form).filter(([, value]) => value instanceof File) as unknown as [
    string,
    File
  ][]

  if (files.length > options.totalFiles!) {
    throw new Error('Too many files')
  }

  return files
}

export function normalizeOptions(
  options: HonoFileUploadDiskOption,
  defaultOptions: HonoFileUploadOption
): Required<HonoFileUploadDiskOption> {
  if (typeof options.totalFiles === 'undefined') {
    options.totalFiles = defaultOptions.totalFiles
  }

  if (typeof options.skipNonFormBody === 'undefined' || options.skipNonFormBody === null) {
    options.skipNonFormBody = defaultOptions.skipNonFormBody
  }

  if (typeof options.prefixByMilliseconds === 'undefined') {
    options.prefixByMilliseconds = defaultOptions.prefixByMilliseconds
  }

  if (typeof options.fileNameHandler === 'undefined') {
    options.fileNameHandler = defaultOptions.fileNameHandler
  }

  if (typeof options.autoSetContext === 'undefined') {
    options.autoSetContext = defaultOptions.autoSetContext
  }

  if (
    typeof options.destination === 'undefined' ||
    options.destination === null ||
    options.destination === ''
  ) {
    throw new Error('destination is required')
  }

  return options as Required<HonoFileUploadDiskOption>
}

export async function getFileInformation(value: File, options: HonoFileUploadDiskOption) {
  const fileNames: string[] = []

  if (options.prefixByMilliseconds) {
    fileNames.push(Date.now().toString())
  }

  if (options.fileNameHandler) {
    fileNames.push(options.fileNameHandler(value.name))
  } else {
    fileNames.push(value.name)
  }

  const finalName = fileNames.join('-')
  const destination = path.resolve(options.destination, finalName)
  const fileBuffer = Buffer.from(await value.arrayBuffer())

  return {
    fileBuffer,
    destination,
    finalName,
  }
}

export async function uploadToFirestorage(value: File, options: HonoFileUploadFirebaseOption) {
  const { destination, fileBuffer, finalName } = await getFileInformation(value, options)
  const storage = options.storage.bucket().file(destination)

  await storage.save(fileBuffer, {
    contentType: value.type,
    public: true,
  })
  const publicUri = storage.publicUrl()

  return {
    publicUri,
    finalName,
    destination,
  }
}

export async function uploadToS3(value: File, options: HonoFileUploadAwsOption) {
  const { destination, fileBuffer, finalName } = await getFileInformation(value, options)

  const file = await options.storage
    .upload({
      Bucket: destination,
      Key: finalName,
      Body: fileBuffer,
    })
    .promise()

  return {
    publicUri: file.Location,
    finalName,
    destination,
  }
}

export function autoSetToContext(
  c: Context,
  files: [string, File][],
  options: HonoFileUploadOption
) {
  if (!options.autoSetContext) return

  // Set the uploaded files to the context
  c.set('__files__', files)
}
