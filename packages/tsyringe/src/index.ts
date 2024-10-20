import { container, DependencyContainer, InjectionToken } from 'tsyringe'
import type { Context, MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'

declare module 'hono' {
  interface ContextVariableMap {
    resolve: <T>(token: InjectionToken<T>) => T
  }
}

export type Provider = (container: DependencyContainer) => void
export const tsyringe = (...providers: Provider[]): MiddlewareHandler => {
  return createMiddleware(async (c, next) => {
    const childContainer = container.createChildContainer()
    providers.forEach((provider) => provider(childContainer))
    c.set('resolve', <T>(token: InjectionToken<T>) => childContainer.resolve(token))
    await next()
  })
}
