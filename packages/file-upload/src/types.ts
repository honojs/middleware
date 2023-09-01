import type { S3 } from 'aws-sdk'
import type { Storage } from 'firebase-admin/storage'

export type HonoFileUploadOption = {
  minFileSize?: number
  maxFileSize?: number
  totalFiles?: number
  fieldNameSize?: number
  skipNonFormBody?: boolean
  prefixByMilliseconds?: boolean
  fileNameHandler?: (filename: string) => string
  autoSetContext?: boolean
}

export type HonoFileUploadDiskOption = Pick<
  HonoFileUploadOption,
  'totalFiles' | 'skipNonFormBody' | 'prefixByMilliseconds' | 'fileNameHandler' | 'autoSetContext'
> & {
  destination: string
}

export type HonoFileUploadFirebaseOption = HonoFileUploadDiskOption & {
  storage: Storage
}

export type HonoFileUploadAwsOption = HonoFileUploadDiskOption & {
  storage: S3
}
