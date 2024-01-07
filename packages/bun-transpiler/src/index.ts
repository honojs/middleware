import Bun from 'bun'
import { createMiddleware } from 'hono/factory'

type BunTranspilerOptions = {
  extensions: string[]
  headers: HeadersInit
  transpilerOptions: Bun.TranspilerOptions
}

export const bunTranspiler = (
  options: BunTranspilerOptions = {
    extensions: ['.ts', '.tsx'],
    headers: { 'content-type': 'application/javascript' },
    transpilerOptions: {
      minifyWhitespace: true,
      target: 'browser',
    },
  }
) => {
  return createMiddleware(async (c, next) => {
    await next()
    const url = new URL(c.req.url)
    const { extensions, headers, transpilerOptions } = options

    if (extensions.every((ext) => !url.pathname.endsWith(ext))) return

    try {
      const loader = url.pathname.split('.').pop() as Bun.TranspilerOptions['loader']
      const transpiler = new Bun.Transpiler({
        loader,
        ...transpilerOptions,
      })
      const transpiledCode = await transpiler.transformSync(await c.res.text())
      c.res = c.newResponse(transpiledCode, { headers })
    } catch (error) {
      console.warn(`Error transpiling ${url.pathname}: ${error}`)
      const errorHeaders = {
        ...headers,
        'content-type': 'text/plain',
      }
      if (error instanceof Error) {
        c.res = c.newResponse(error.message, {
          status: 500,
          headers: errorHeaders,
        })
      } else {
        c.res = c.newResponse('Malformed Input', {
          status: 500,
          headers: errorHeaders,
        })
      }
    }
  })
}
