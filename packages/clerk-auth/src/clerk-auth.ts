import { createClerkClient } from '@clerk/backend'
import type { AuthObject, ClerkClient } from '@clerk/backend'
import type {
  AuthenticateRequestOptions,
  AuthOptions,
  GetAuthFn,
  GetAuthFnNoRequest,
} from '@clerk/backend/internal'
import { getAuthObjectForAcceptedToken } from '@clerk/backend/internal'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'

export type ClerkAuthVariables = {
  clerk: ClerkClient
  clerkAuth: GetAuthFnNoRequest
}

export const getAuth: GetAuthFn<Context> = ((c: Context, options?: AuthOptions) => {
  const authFn = c.get('clerkAuth')
  return authFn(options)
}) as GetAuthFn<Context>

type ClerkEnv = {
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  CLERK_API_URL: string
  CLERK_API_VERSION: string
}

type ClerkMiddlewareOptions = Omit<AuthenticateRequestOptions, 'acceptsToken'>

export const clerkMiddleware = (options?: ClerkMiddlewareOptions): MiddlewareHandler => {
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
      acceptsToken: 'any',
    })

    if (requestState.headers) {
      requestState.headers.forEach((value, key) => {
        c.res.headers.append(key, value)
      })

      const locationHeader = requestState.headers.get('location')

      if (locationHeader) {
        return c.redirect(locationHeader, 307)
      } else if (requestState.status === 'handshake') {
        throw new Error('Clerk: unexpected handshake without redirect')
      }
    }

    const authObjectFn = ((options?: AuthOptions) =>
      getAuthObjectForAcceptedToken({
        authObject: requestState.toAuth(options) as AuthObject,
        acceptsToken: 'any',
      })) as GetAuthFnNoRequest

    c.set('clerkAuth', authObjectFn)
    c.set('clerk', clerkClient)

    await next()
  }
}
