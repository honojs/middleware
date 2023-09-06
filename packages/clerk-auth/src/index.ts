import type { ClerkOptions } from '@clerk/backend'
import { Clerk, createIsomorphicRequest, constants } from '@clerk/backend'
import type { Context, MiddlewareHandler } from 'hono'

type ClerkAuth = Awaited<
  ReturnType<ReturnType<typeof Clerk>['authenticateRequest']>
>['toAuth'];

declare module 'hono' {
  interface ContextVariableMap {
    clerk: ReturnType<typeof Clerk>;
    clerkAuth: ReturnType<ClerkAuth>;
  }
}

export const getAuth = (c: Context) => {
  return c.get('clerkAuth')
}

export const clerkMiddleware = (options?: ClerkOptions): MiddlewareHandler => {
  return async (c, next) => {
    const { secretKey, publishableKey, apiUrl, apiVersion, ...rest } = options || {
      secretKey: c.env.CLERK_SECRET_KEY || '',
      publishableKey: c.env.CLERK_PUBLISHABLE_KEY || '',
      apiUrl: c.env.CLERK_API_URL || 'https://api.clerk.dev',
      apiVersion: c.env.CLERK_API_VERSION || 'v1',
    }
    const frontendApi = c.env.CLERK_FRONTEND_API || ''
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
          headers: c.req.headers,
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
