import { createMiddleware } from 'hono/factory'
import i18next from 'i18next'
import type { InitOptions, TFunction } from 'i18next'

declare module 'hono' {
  interface ContextVariableMap {
    t: TFunction
  }
}

export interface I18nextMiddlewareOptions extends InitOptions {
  headerName: string
  setLanguageChanges?: boolean
}

const useI18next = ({
  headerName,
  setLanguageChanges = false,
  ...initOptions
}: I18nextMiddlewareOptions) => {
  if (!i18next.isInitialized) {
    i18next.init(initOptions)
  }

  return createMiddleware(async (c, next) => {
    const language = c.req.header(headerName) || initOptions.lng

    const t = (key: string, options?: object) => {
      return i18next.t(key, { lng: language, ...options })
    }

    if (setLanguageChanges) {
      await i18next.changeLanguage(language)
    }

    c.set('t', t)

    await next()
  })
}

export { i18next, useI18next }
