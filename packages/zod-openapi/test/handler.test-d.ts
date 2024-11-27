import type { MiddlewareHandler } from 'hono'
import type { Equal, Expect } from 'hono/utils/types'
import type { MiddlewareToHandlerType, OfHandlerType, RouteHandler } from '../src'

import { OpenAPIHono, createRoute, z } from '../src'

describe('supports async handler', () => {
  const route = createRoute({
    method: 'get',
    path: '/users',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
            }),
          },
        },
        description: 'Retrieve the user',
      },
    },
  })

  test('argument of openapi method', () => {
    const hono = new OpenAPIHono()

    hono.openapi(route, (c) => {
      return c.json({
        id: '123',
      })
    })

    hono.openapi(route, async (c) => {
      return c.json({
        id: '123',
      })
    })
  })

  test('RouteHandler type', () => {
    const handler: RouteHandler<typeof route> = (c) => {
      return c.json({
        id: '123',
      })
    }

    const asyncHandler: RouteHandler<typeof route> = async (c) => {
      return c.json({
        id: '123',
      })
    }

    const hono = new OpenAPIHono()
    hono.openapi(route, handler)
    hono.openapi(route, asyncHandler)
  })

  test('RouteHandler infers env type from middleware', () => {
    type CustomEnv = { Variables: { customKey: string } }

    const customMiddleware: MiddlewareHandler<CustomEnv> = (c, next) => {
      c.set('customKey', 'customValue')
      return next()
    }

    const routeWithMiddleware = createRoute({
      method: 'get',
      path: '/users',
      middleware: [customMiddleware] as const,
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({
                id: z.string(),
              }),
            },
          },
          description: 'Retrieve the user',
        },
      },
    })

    const handler: RouteHandler<typeof routeWithMiddleware> = (c) => {
      return c.json({
        id: c.get('customKey'),
      })
    }

    const hono = new OpenAPIHono()
    hono.openapi(routeWithMiddleware, handler)
  })

  test('RouteHandler infers complex objects from multiple middleware handlers', () => {
    // https://github.com/honojs/middleware/issues/847
    type CustomEnv = { Variables: { session: { id: string; createdAt: Date } } }

    const setSessionMiddleware: MiddlewareHandler<CustomEnv> = (c, next) => {
      c.set('session', { id: '8e760fe8-f064-4929-b632-737f88213e57', createdAt: new Date() })
      return next()
    }

    const validateSessionMiddleware: MiddlewareHandler<CustomEnv> = async (c, next) => {
      const session = c.get('session')
      if ((new Date().getTime() - session.createdAt.getTime()) / 1000 / 60 / 60 > 1) {
        return c.json({ message: 'Unauthorized' }, 401)
      }
      return await next()
    }

    type Example = MiddlewareToHandlerType<
      [typeof setSessionMiddleware, typeof validateSessionMiddleware]
    >

    // ensure the first defined env does not lose its type in multi-middleware handler
    type Verify = Expect<
      Equal<
        OfHandlerType<Example>['env'],
        {
          Variables: CustomEnv['Variables']
        }
      >
    >
  })

  test('Route accepts c.html when html like content type is specified', () => {
    const route = createRoute({
      method: 'get',
      path: '/html',
      responses: {
        200: {
          content: {
            'text/html': {
              schema: z.string(),
            },
          },
          description: 'Return HTML',
        },
      },
    })

    const handler: RouteHandler<typeof route> = (c) => {
      return c.html('<h1>Hello from html</h1>')
    }

    const route2 = createRoute({
      method: 'get',
      path: '/vnd/html',
      responses: {
        200: {
          content: {
            'application/vnd.dtg.local.html': {
              schema: z.string(),
            },
          },
          description: 'Return HTML',
        },
      },
    })

    const handler2: RouteHandler<typeof route2> = (c) => {
      return c.html('<h1>Hello from vnd html</h1>')
    }

    const hono = new OpenAPIHono()
    hono.openapi(route, handler)
    hono.openapi(route2, handler2)
  })
})
