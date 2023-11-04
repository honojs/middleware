import * as esbuild from 'esbuild'
import { createMiddleware } from 'hono/factory'
import { esbuildTranspiler as baseTranspiler } from '../transpiler'
import type { EsbuildTranspilerOptions } from '../transpiler'

const transpiler = (options?: Partial<Omit<EsbuildTranspilerOptions, 'esbuild'>>) => {
  return createMiddleware(async (c, next) => {
    return await baseTranspiler({
      esbuild,
      ...options,
    })(c, next)
  })
}

export { transpiler as esbuildTranspiler }
