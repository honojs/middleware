import * as esbuild from 'esbuild'
import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { esbuildTranspiler as baseTranspiler } from '../transpiler.ts'
import type { EsbuildTranspilerOptions } from '../transpiler.ts'

const transpiler = (
  options?: Partial<Omit<EsbuildTranspilerOptions, 'esbuild'>>
): MiddlewareHandler => {
  return createMiddleware(async (c, next) => {
    return await baseTranspiler({
      esbuild,
      ...options,
    })(c, next)
  })
}

export { transpiler as esbuildTranspiler }
