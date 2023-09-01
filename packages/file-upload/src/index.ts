import fs from 'fs-extra'
import type { MiddlewareHandler } from 'hono'
import { DEFAULT_MAX_SIZE, DEFAULT_MIN_SIZE } from './constants'
import {
  autoSetToContext,
  getFileInformation,
  getFiles,
  normalizeOptions,
  uploadToFirestorage,
  uploadToS3,
  validateContentType,
} from './helper'
import type {
  HonoFileUploadAwsOption,
  HonoFileUploadDiskOption,
  HonoFileUploadFirebaseOption,
  HonoFileUploadOption,
} from './types'

export class HonoFileUpload {
  private options: Required<HonoFileUploadOption>

  constructor(options: HonoFileUploadOption = {}) {
    this.options = {
      fieldNameSize: options?.fieldNameSize ?? 100,
      maxFileSize: options?.maxFileSize ?? DEFAULT_MAX_SIZE,
      minFileSize: options?.minFileSize ?? DEFAULT_MIN_SIZE,
      totalFiles: options?.totalFiles ?? Infinity,
      skipNonFormBody: options?.skipNonFormBody ?? false,
      prefixByMilliseconds: options?.prefixByMilliseconds ?? false,
      fileNameHandler: options?.fileNameHandler ?? ((filename: string) => filename),
      autoSetContext: options?.autoSetContext ?? false,
    }
  }

  public saveToDisk(options: HonoFileUploadDiskOption): MiddlewareHandler {
    options = normalizeOptions(options, this.options) as HonoFileUploadDiskOption

    return async function (c, next) {
      await validateContentType(c, next, options)

      const files = await getFiles(c, options)

      if (files.length === 0) {
        return next()
      }

      if (!(await fs.exists(options.destination))) {
        await fs.mkdirp(options.destination)
      }

      await Promise.all(
        files.map(async ([, value]) => {
          const { destination, fileBuffer, finalName } = await getFileInformation(value, options)

          // Assign new attributes to the files object
          Object.assign(value, {
            savedTo: destination,
            savedName: finalName,
            originalName: value.name,
          })

          return fs.writeFile(destination, fileBuffer)
        })
      )

      autoSetToContext(c, files, options)

      return next()
    }
  }

  public saveToFirebase(options: HonoFileUploadFirebaseOption): MiddlewareHandler {
    options = normalizeOptions(options, this.options) as HonoFileUploadFirebaseOption

    return async function (c, next) {
      await validateContentType(c, next, options)

      const files = await getFiles(c, options)

      if (files.length === 0) {
        return next()
      }

      await Promise.all(
        files.map(async ([, value]) => {
          const { destination, finalName, publicUri } = await uploadToFirestorage(value, options)

          // Assign new attributes to the files object
          Object.assign(value, {
            savedTo: destination,
            savedName: finalName,
            originalName: value.name,
            uri: publicUri,
          })
        })
      )

      autoSetToContext(c, files, options)

      return next()
    }
  }

  public saveToAws(options: HonoFileUploadAwsOption): MiddlewareHandler {
    options = normalizeOptions(options, this.options) as HonoFileUploadAwsOption

    return async function (c, next) {
      await validateContentType(c, next, options)

      const files = await getFiles(c, options)

      if (files.length === 0) {
        return next()
      }

      await Promise.all(
        files.map(async ([, value]) => {
          const { destination, finalName, publicUri } = await uploadToS3(value, options)

          // Assign new attributes to the files object
          Object.assign(value, {
            savedTo: destination,
            savedName: finalName,
            originalName: value.name,
            uri: publicUri,
          })
        })
      )

      autoSetToContext(c, files, options)

      return next()
    }
  }
}
