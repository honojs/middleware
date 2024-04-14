import { createMiddleware } from 'hono/factory'
import type { transform, initialize } from './types.esbuild'

export type EsbuildLike = {
  transform: typeof transform
  initialize: typeof initialize
}

export type TransformOptions = Partial<Parameters<typeof transform>[1]>

export type EsbuildTranspilerOptions = {
  extensions?: string[]
  cache?: boolean
  esbuild?: EsbuildLike
  contentType?: string
  transformOptions?: TransformOptions
}

export const esbuildTranspiler = (options?: EsbuildTranspilerOptions) => {
  const esbuild: EsbuildLike | undefined = options?.esbuild

  return createMiddleware(async (c, next) => {
    await next()
    if (esbuild) {
      const url = new URL(c.req.url)
      const extensions = options?.extensions ?? ['.ts', '.tsx']

      if (extensions.every((ext) => !url.pathname.endsWith(ext))) {
        return
      }

      const script = await c.res.text()
      const transformOptions: TransformOptions = options?.transformOptions ?? {}

      try {
        const { code } = await esbuild.transform(script, {
          loader: 'tsx',
          ...transformOptions,
        })
        c.res = c.body(code)
        c.res.headers.set('content-type', options?.contentType ?? 'text/javascript')
        c.res.headers.delete('content-length')
      } catch (ex) {
        console.warn('Error transpiling ' + url.pathname + ': ' + ex)
        c.res = new Response(script, {
          status: 500,
          headers: { 'content-type': options?.contentType ?? 'text/javascript' },
        })
      }
    }
  })
}
