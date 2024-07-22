import { createMiddleware } from 'hono/factory'
import { HonoBase } from 'hono/hono-base'

const INFO_COLOR = '\x1b[36m'
const RESET_COLOR = '\x1b[0m'

export const brief = (app: HonoBase, title: string = 'APP ROUTES') => {
  return createMiddleware(async (_, next) => {
    const uniqueRoutes = app.routes.filter((value, index) => {
      const _value = JSON.stringify(value)

      return (
        index ===
        app.routes.findIndex((obj) => {
          return JSON.stringify(obj) === _value
        })
      )
    })

    const mappedRoutes = uniqueRoutes
      .filter(({ method }) => method != 'ALL')
      .map(({ path, method }) => ({ path, method }))

    console.info(`${INFO_COLOR}[INFO] ${title}:${RESET_COLOR}`)
    console.table(mappedRoutes)
    console.log()

    await next()
  })
}
