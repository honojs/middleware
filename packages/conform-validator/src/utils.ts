import type { Context } from 'hono'
import { bufferToFormData } from 'hono/utils/buffer'

export const getFormDataFromContext = async (ctx: Context): Promise<FormData> => {
  const contentType = ctx.req.header('Content-Type')
  if (!contentType) {
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
