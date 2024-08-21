import type { Context } from 'hono'
import { bufferToFormData } from 'hono/utils/buffer'

// ref: https://github.com/honojs/hono/blob/a63bcfd6fba66297d8234c21aed8a42ac00711fe/src/validator/validator.ts#L27-L28
const multipartRegex = /^multipart\/form-data(; boundary=[A-Za-z0-9'()+_,\-./:=?]+)?$/
const urlencodedRegex = /^application\/x-www-form-urlencoded$/

export const getFormDataFromContext = async (ctx: Context): Promise<FormData> => {
  const contentType = ctx.req.header('Content-Type')
  if (!contentType || !(multipartRegex.test(contentType) || urlencodedRegex.test(contentType))) {
    return new FormData()
  }

  const cache = ctx.req.bodyCache.formData
  if (cache) {
    return cache
  }

  const arrayBuffer = await ctx.req.arrayBuffer()
  const formData = await bufferToFormData(arrayBuffer, contentType)

  ctx.req.bodyCache.formData = formData

  return formData
}
