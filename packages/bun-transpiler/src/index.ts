import Bun from 'bun'
import { createMiddleware } from 'hono/factory'

type BunTranspilerOptions = {
  extensions?: string[]
  headers?: Record<string, string | string[]>
  transpilerOptions?: Bun.TranspilerOptions
}

const DEFAULT_OPTIONS: BunTranspilerOptions = {
  extensions: ['.ts', '.tsx'],
  headers: { 'content-type': 'application/javascript' },
  transpilerOptions: {
    minifyWhitespace: true,
    target: 'browser',
  },
}

export const bunTranspiler = (options?: BunTranspilerOptions) => {
  return createMiddleware(async (c, next) => {
    await next()
    const url = new URL(c.req.url)
    const extensions = options?.extensions ?? DEFAULT_OPTIONS.extensions
    const headers = options?.headers ?? DEFAULT_OPTIONS.headers

    if (extensions?.every((ext) => !url.pathname.endsWith(ext))) return

    try {
      const loader = url.pathname.split('.').pop() as Bun.TranspilerOptions['loader']
      const transpilerOptions = options?.transpilerOptions ?? DEFAULT_OPTIONS.transpilerOptions
      const transpiler = new Bun.Transpiler({
        loader,
        ...transpilerOptions,
      })
      const transpiledCode = await transpiler.transformSync(await c.res.text())
      c.res = c.newResponse(transpiledCode, 200, headers)
    } catch (error) {
      console.warn(`Error transpiling ${url.pathname}: ${error}`)
      const errorHeaders = {
        ...headers,
        'content-type': 'text/plain',
      }
      if (error instanceof Error) {
        c.res = c.newResponse(error.message, 500, errorHeaders)
      } else {
        c.res = c.newResponse('Malformed Input', 500, errorHeaders)
      }
    }
  })
}
