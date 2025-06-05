import { createClerkClient } from '@clerk/backend'
import type { ClerkClient, ClerkOptions } from '@clerk/backend'
import type { SignedInAuthObject, SignedOutAuthObject } from '@clerk/backend/internal'
import type { PendingSessionOptions } from '@clerk/types'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'

type GetAuthOptions = PendingSessionOptions

declare module 'hono' {
  interface ContextVariableMap {
    clerk: ClerkClient
    clerkAuth: (options?: GetAuthOptions) => SignedInAuthObject | SignedOutAuthObject | null
  }
}

export const getAuth = (c: Context, options?: GetAuthOptions) => {
  const authFn = c.get('clerkAuth')
  return authFn(options)
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
      apiUrl: clerkEnv.CLERK_API_URL,
      apiVersion: clerkEnv.CLERK_API_VERSION,
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

    if (requestState.headers) {
      requestState.headers.forEach((value, key) => c.res.headers.append(key, value))

      const locationHeader = requestState.headers.get('location')

      if (locationHeader) {
        return c.redirect(locationHeader, 307)
      } else if (requestState.status === 'handshake') {
        throw new Error('Clerk: unexpected handshake without redirect')
      }
    }

    c.set('clerkAuth', (options) => requestState.toAuth(options))
    c.set('clerk', clerkClient)

    await next()
  }
}
