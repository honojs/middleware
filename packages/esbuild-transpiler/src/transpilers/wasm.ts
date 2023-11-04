import * as esbuild from 'esbuild-wasm'
import { createMiddleware } from 'hono/factory'
import { esbuildTranspiler as baseTranspiler } from '../transpiler'
import type { EsbuildTranspilerOptions } from '../transpiler'

let initialized = false

const transpiler = (
  options: Partial<Omit<EsbuildTranspilerOptions, 'esbuild'>> & {
    wasmModule?: WebAssembly.Module
    wasmURL?: string | URL
  }
) => {
  return createMiddleware(async (c, next) => {
    if (!initialized) {
      if (options.wasmModule) {
        await esbuild.initialize({
          wasmModule: options.wasmModule,
          worker: false,
        })
      } else if (options.wasmURL) {
        await esbuild.initialize({
          wasmURL: options.wasmURL,
          worker: false,
        })
      } else {
        throw 'wasmModule or wasmURL option is required.'
      }
      initialized = true
    }
    return await baseTranspiler({
      esbuild,
      ...options,
    })(c, next)
  })
}

export { transpiler as esbuildTranspiler }
