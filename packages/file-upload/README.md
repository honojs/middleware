# Hono File Upload

This is a File upload middleware library for [Hono](https://github.com/honojs/hono) which can save file to your server disk, Firebase FireStorage, or event AWS S3.

## Install

```
npm install @hono/file-upload
```

## Usage

```ts
import { Hono } from 'hono'
import { HonoFileUpload } from '@hono/file-upload'

const app = new Hono()
const fileUpload = new HonoFileUpload()

// Save to server disk
app.post(
  '/upload/disk',
  fileUpload.saveToDisk({
    // Pass the destination path
    destination: __dirname,
  }),
  (c) => c.text('OK'
)

// Save to firebase firestorage
app.post(
  '/upload/firestorage',
  fileUpload.saveToFirebase({
    // Pass the destination path in the firebase firestorage
    destination: '/',
    // Pass the firebase-admin storage instance
    storage: ...
  }),
  (c) => c.text('OK'
)

// Save to aws s3
app.post(
  '/upload/firestorage',
  fileUpload.saveToAws({
    // Pass the bucket path in the aws s3
    destination: '/',
    // Pass the aws s3 instance
    storage: ...
  }),
  (c) => c.text('OK'
)
```

## Author

krsbx <https://github.com/krsbx>

## License

MIT
