import type { ClerkOptions } from '@clerk/backend'
import { Clerk, createIsomorphicRequest, constants } from '@clerk/backend'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'

type ClerkAuth = Awaited<ReturnType<ReturnType<typeof Clerk>['authenticateRequest']>>['toAuth']

declare module 'hono' {
  interface ContextVariableMap {
    clerk: ReturnType<typeof Clerk>
    clerkAuth: ReturnType<ClerkAuth>
  }
}

export const getAuth = (c: Context) => {
  return c.get('clerkAuth')
}

type ClerkEnv = {
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_API_URL: string
  CLERK_API_VERSION: string
  CLERK_FRONTEND_API: string
}

export const clerkMiddleware = (options?: ClerkOptions): MiddlewareHandler => {
  return async (c, next) => {
    const clerkEnv = env<ClerkEnv>(c)
    const { secretKey, publishableKey, apiUrl, apiVersion, ...rest } = options || {
      secretKey: clerkEnv.CLERK_SECRET_KEY || '',
      publishableKey: clerkEnv.CLERK_PUBLISHABLE_KEY || '',
      apiUrl: clerkEnv.CLERK_API_URL || 'https://api.clerk.dev',
      apiVersion: clerkEnv.CLERK_API_VERSION || 'v1',
    }
    const frontendApi = clerkEnv.CLERK_FRONTEND_API || ''
    if (!secretKey) {
      throw new Error('Missing Clerk Secret key')
    }

    if (!publishableKey) {
      throw new Error('Missing Clerk Publishable key')
    }

    const clerkClient = Clerk({
      ...rest,
      apiUrl,
      apiVersion,
      secretKey,
      publishableKey,
    })

    const requestState = await clerkClient.authenticateRequest({
      ...rest,
      secretKey,
      publishableKey,
      request: createIsomorphicRequest((Request) => {
        return new Request(c.req.url, {
          method: c.req.method,
          headers: c.req.raw.headers,
        })
      }),
    })

    // Interstitial cases
    if (requestState.isUnknown) {
      c.header(constants.Headers.AuthReason, requestState.reason)
      c.header(constants.Headers.AuthMessage, requestState.message)
      return c.body(null, 401)
    }

    if (requestState.isInterstitial) {
      const interstitialHtmlPage = clerkClient.localInterstitial({
        publishableKey,
        frontendApi,
      })

      c.header(constants.Headers.AuthReason, requestState.reason)
      c.header(constants.Headers.AuthMessage, requestState.message)

      return c.html(interstitialHtmlPage, 401)
    }

    c.set('clerkAuth', requestState.toAuth())
    c.set('clerk', clerkClient)

    await next()
  }
}
