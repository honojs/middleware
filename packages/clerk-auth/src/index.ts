import { type ClerkClient, type ClerkOptions, createClerkClient } from '@clerk/backend'
import { PROD_API_URL } from '@clerk/shared'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'

type ClerkAuth = ReturnType<Awaited<ReturnType<ClerkClient['authenticateRequest']>>['toAuth']>

declare module 'hono' {
  interface ContextVariableMap {
    clerk: ClerkClient
    clerkAuth: ClerkAuth
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
}

export const clerkMiddleware = (options?: ClerkOptions): MiddlewareHandler => {
  return async (c, next) => {
    const clerkEnv = env<ClerkEnv>(c)
    const { secretKey, publishableKey, apiUrl, apiVersion, ...rest } = options || {
      secretKey: clerkEnv.CLERK_SECRET_KEY || '',
      publishableKey: clerkEnv.CLERK_PUBLISHABLE_KEY || '',
      apiUrl: clerkEnv.CLERK_API_URL || PROD_API_URL,
      apiVersion: clerkEnv.CLERK_API_VERSION || 'v1',
    }
    if (!secretKey) {
      throw new Error('Missing Clerk Secret key')
    }

    if (!publishableKey) {
      throw new Error('Missing Clerk Publishable key')
    }

    const clerkClient = createClerkClient({
      ...rest,
      apiUrl,
      apiVersion,
      secretKey,
      publishableKey,
    })

    const requestState = await clerkClient.authenticateRequest(c.req.raw, {
      ...rest,
      secretKey,
      publishableKey,
    })

    // Append headers from clerk
    if (requestState.headers) {
      requestState.headers.forEach((value, key) => c.header(key, value, { append: true }))
    }

    // Interstitial case
    if (requestState.status === 'handshake') {
      // Throw an error if state is handshake without a redirect (see https://github.com/clerk/javascript/blob/83ec173b08bdf18fda805e0d68e0034dbae0eb24/packages/sdk-node/src/authenticateRequest.ts#L72)
      const hasLocationHeader = requestState.headers.get('location')
      if (!hasLocationHeader) {
        throw new Error('Clerk: unexpected handshake without redirect')
      }

      return c.body(null, 307)
    }

    c.set('clerkAuth', requestState.toAuth())
    c.set('clerk', clerkClient)

    await next()
  }
}
