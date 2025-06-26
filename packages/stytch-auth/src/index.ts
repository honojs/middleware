import type { Context, MiddlewareHandler } from 'hono'
import { env } from 'hono/adapter'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { Session, User, MemberSession, Member, Organization } from 'stytch'
import { Client, B2BClient } from 'stytch'

/**
 * Environment variables required for Stytch configuration
 */
type StytchEnv = {
  /** The Stytch project ID */
  STYTCH_PROJECT_ID: string
  /** The Stytch project secret */
  STYTCH_PROJECT_SECRET: string
  /** The Stytch Project domain */
  STYTCH_DOMAIN?: string
}

type ConsumerTokenClaims = Awaited<ReturnType<Client['idp']['introspectTokenLocal']>>
type B2BTokenClaims = Awaited<ReturnType<B2BClient['idp']['introspectTokenLocal']>>

/**
 * Configuration options for Consumer local session authentication
 */
type LocalMiddlewareOpts = {
  /** Maximum age of the JWT token in seconds */
  maxTokenAgeSeconds?: number
  /**
   * Custom function to extract session JWT from the request context.
   * @example
   * // Read from a custom cookie name
   * getCredential: (c) => ({ session_jwt: getCookie(c, 'my_custom_jwt') ?? '' })
   *
   * @example
   * // Read from Authorization header
   * getCredential: (c) => ({ session_jwt: c.req.header('Authorization')?.replace('Bearer ', '') ?? '' })
   *
   * @example
   * // Read from custom header
   * getCredential: (c) => ({ session_jwt: c.req.header('X-Session-JWT') ?? '' })
   */
  getCredential?: (c: Context) => { session_jwt: string }
  /**
   * Custom error handler for authentication failures.
   * @example
   * // Redirect to login page
   * onError: (c, error) => {
   *   return c.redirect('/login')
   * }
   *
   * @example
   * // Return custom error response
   * onError: (c, error) => {
   *   const errorResponse = new Response('Session expired', {
   *     status: 401,
   *     headers: { 'WWW-Authenticate': 'Bearer realm="app"' }
   *   })
   *   throw new HTTPException(401, { res: errorResponse })
   * }
   */
  onError?: (c: Context, error: Error) => Response | void
}

/**
 * Configuration options for Consumer remote session authentication
 */
type OnlineMiddlewareOpts = {
  /**
   * Custom function to extract session credentials from the request context.
   * Can return either a JWT or session token for flexibility.
   * @example
   * // Read JWT from custom cookie
   * getCredential: (c) => ({ session_jwt: getCookie(c, 'custom_jwt_cookie') ?? '' })
   *
   * @example
   * // Read opaque session token instead of JWT
   * getCredential: (c) => ({ session_token: getCookie(c, 'stytch_session_token') ?? '' })
   *
   * @example
   * // Read from custom header
   * getCredential: (c) => ({ session_jwt: c.req.header('X-Session-JWT') ?? '' })
   */
  getCredential?: (c: Context) => { session_jwt: string } | { session_token: string }
  /**
   * Custom error handler for authentication failures.
   * @example
   * // Redirect to login page
   * onError: (c, error) => {
   *   return c.redirect('/login')
   * }
   *
   * @example
   * // Return custom error response
   * onError: (c, error) => {
   *   const errorResponse = new Response('Session expired', {
   *     status: 401,
   *     headers: { 'WWW-Authenticate': 'Bearer realm="app"' }
   *   })
   *   throw new HTTPException(401, { res: errorResponse })
   * }
   */
  onError?: (c: Context, error: Error) => Response | void
}

/**
 * Configuration options for OAuth2 bearer token authentication
 */
type OAuthMiddlewareOpts = {
  /**
   * Custom function to extract bearer token from the request context.
   * @example
   * // Read from custom header instead of Authorization
   * getCredential: (c) => ({ access_token: c.req.header('X-API-Token') ?? '' })
   *
   * @example
   * // Read from cookie
   * getCredential: (c) => ({ access_token: getCookie(c, 'oauth_token') ?? '' })
   *
   * @example
   * // Read from query parameter
   * getCredential: (c) => ({ access_token: c.req.query('access_token') ?? '' })
   */
  getCredential?: (c: Context) => { access_token: string }
  /**
   * Custom error handler for OAuth authentication failures.
   * @example
   * // Set WWW-Authenticate header
   * onError: (c, error) => {
   *   const errorResponse = new Response('Unauthorized', {
   *     status: 401,
   *     headers: { 'WWW-Authenticate': 'Bearer realm="api", error="invalid_token"' }
   *   })
   *   throw new HTTPException(401, { res: errorResponse })
   * }
   */
  onError?: (c: Context, error: Error) => void
}

/**
 * Configuration options for B2B OAuth2 bearer token authentication
 */
type B2BOAuthMiddlewareOpts = {
  /**
   * Custom function to extract bearer token from the request context.
   * @example
   * // Read from B2B-specific API key header
   * getCredential: (c) => ({ access_token: c.req.header('X-B2B-API-Key') ?? '' })
   *
   * @example
   * // Read from organization-scoped cookie
   * getCredential: (c) => ({ access_token: getCookie(c, 'b2b_oauth_token') ?? '' })
   *
   * @example
   * // Read from custom Authorization scheme
   * getCredential: (c) => ({ access_token: c.req.header('Authorization')?.replace('B2B-Bearer ', '') ?? '' })
   */
  getCredential?: (c: Context) => { access_token: string }
  /**
   * Custom error handler for B2B OAuth authentication failures.
   * @example
   * // Set WWW-Authenticate header for B2B
   * onError: (c, error) => {
   *   const errorResponse = new Response('Unauthorized', {
   *     status: 401,
   *     headers: { 'WWW-Authenticate': 'Bearer realm="b2b-api", error="invalid_token"' }
   *   })
   *   throw new HTTPException(401, { res: errorResponse })
   * }
   */
  onError?: (c: Context, error: Error) => void
}

/**
 * Default credential extractor for session JWT from standard cookie
 */
const defaultSessionCredential = (c: Context) => ({
  session_jwt: getCookie(c, 'stytch_session_jwt') ?? '',
})

/**
 * Cache for Consumer Stytch client instances keyed by project ID
 */
const consumerClients: Record<string, Client> = {}

/**
 * Gets or creates a Consumer Stytch client instance for the given context
 * @param c - The Hono request context
 * @returns A Consumer Stytch client instance
 */
const getConsumerClient = (c: Context) => {
  const stytchEnv = env<StytchEnv>(c)
  consumerClients[stytchEnv.STYTCH_PROJECT_ID] =
    consumerClients[stytchEnv.STYTCH_PROJECT_ID] ||
    new Client({
      project_id: stytchEnv.STYTCH_PROJECT_ID,
      secret: stytchEnv.STYTCH_PROJECT_SECRET,
      custom_base_url: stytchEnv.STYTCH_DOMAIN,
    })
  return consumerClients[stytchEnv.STYTCH_PROJECT_ID]
}

/**
 * Cache for B2B Stytch client instances keyed by project ID
 */
const b2bClients: Record<string, B2BClient> = {}

/**
 * Gets or creates a B2B Stytch client instance for the given context
 * @param c - The Hono request context
 * @returns A B2B Stytch client instance
 */
const getB2BClient = (c: Context) => {
  const stytchEnv = env<StytchEnv>(c)
  b2bClients[stytchEnv.STYTCH_PROJECT_ID] =
    b2bClients[stytchEnv.STYTCH_PROJECT_ID] ||
    new B2BClient({
      project_id: stytchEnv.STYTCH_PROJECT_ID,
      secret: stytchEnv.STYTCH_PROJECT_SECRET,
      custom_base_url: stytchEnv.STYTCH_DOMAIN,
    })
  return b2bClients[stytchEnv.STYTCH_PROJECT_ID]
}

/**
 * Consumer Stytch authentication utilities for Hono middleware
 */
export const Consumer = {
  /**
   * Gets the Consumer Stytch client instance for the given context
   * @param c - The Hono request context
   * @returns Consumer Stytch client instance
   */
  getClient: (c: Context) => getConsumerClient(c),

  /**
   * Creates middleware for local session authentication using JWT validation only
   * @param opts - Optional configuration for local authentication
   * @returns Hono middleware handler
   */
  authenticateSessionLocal:
    (opts?: LocalMiddlewareOpts): MiddlewareHandler =>
    async (c, next) => {
      const stytchClient = Consumer.getClient(c)

      const getCredential = opts?.getCredential ?? defaultSessionCredential

      try {
        const { session } = await stytchClient.sessions.authenticateJwt({
          ...getCredential(c),
          max_token_age_seconds: opts?.maxTokenAgeSeconds,
        })

        c.set('stytchSession', session)
      } catch (error) {
        if (opts?.onError) {
          const result = opts.onError(c, error as Error)
          if (result) return result
        }
        throw new HTTPException(401, { message: 'Unauthenticated' })
      }

      await next()
    },

  /**
   * Creates middleware for remote session authentication that validates with Stytch servers
   * @param opts - Optional configuration for remote authentication
   * @returns Hono middleware handler
   */
  authenticateSessionRemote:
    (opts?: OnlineMiddlewareOpts): MiddlewareHandler =>
    async (c, next) => {
      const stytchClient = Consumer.getClient(c)

      const getCredential = opts?.getCredential ?? defaultSessionCredential

      try {
        const { user, session } = await stytchClient.sessions.authenticate({
          ...getCredential(c),
        })

        c.set('stytchSession', session)
        c.set('stytchUser', user)
      } catch (error) {
        if (opts?.onError) {
          const result = opts.onError(c, error as Error)
          if (result) return result
        }
        throw new HTTPException(401, { message: 'Unauthenticated' })
      }

      await next()
    },

  /**
   * Retrieves the authenticated Consumer session from the request context
   * @param c - The Hono request context
   * @returns The Consumer session object
   * @throws Error if no session is found in context
   */
  getStytchSession: (c: Context): Session => {
    const session = c.get('stytchSession')
    if (!session) {
      throw Error(
        'No session in context. Was Consumer.authenticateSessionLocal or Consumer.authenticateSessionRemote called?'
      )
    }
    return session
  },

  /**
   * Retrieves the authenticated Consumer user from the request context
   * @param c - The Hono request context
   * @returns The Consumer user object
   * @throws Error if no user is found in context (only available after remote authentication)
   */
  getStytchUser: (c: Context): User => {
    const user = c.get('stytchUser')
    if (!user) {
      throw Error('No user in context. Was Consumer.authenticateSessionRemote called?')
    }
    return user
  },

  /**
   * Creates middleware for OAuth2 bearer token authentication
   * @param opts - Optional configuration for OAuth authentication
   * @returns Hono middleware handler
   */
  authenticateOAuthToken:
    (opts?: OAuthMiddlewareOpts): MiddlewareHandler =>
    async (c, next) => {
      const stytchClient = Consumer.getClient(c)

      try {
        const authHeader = c.req.header('Authorization')
        if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
          throw new Error('Missing or invalid access token')
        }
        const bearerToken = authHeader.substring(7)
        const claims = await stytchClient.idp.introspectTokenLocal(bearerToken)

        c.set('stytchOAuthClaims', claims)
        c.set('stytchOAuthToken', bearerToken)
      } catch (error) {
        if (opts?.onError) {
          opts.onError(c, error as Error)
        }
        throw new HTTPException(401, { message: 'Unauthenticated' })
      }

      await next()
    },

  /**
   * Retrieves the OAuth data from the request context
   * @param c - The Hono request context
   * @returns Object containing OAuth token response and access token
   * @throws Error if no OAuth data is found in context
   */
  getOAuthData: (c: Context): { claims: ConsumerTokenClaims; token: string } => {
    const claims = c.get('stytchOAuthClaims')
    const token = c.get('stytchOAuthToken')
    if (!claims || !token) {
      throw Error('No OAuth data in context. Was Consumer.authenticateOAuthToken called?')
    }
    return { claims, token }
  },
}

/**
 * B2B Stytch authentication utilities for Hono middleware
 */
export const B2B = {
  /**
   * Gets the B2B Stytch client instance for the given context
   * @param c - The Hono request context
   * @returns B2B Stytch client instance
   */
  getClient: (c: Context) => getB2BClient(c),

  /**
   * Creates middleware for local B2B session authentication using JWT validation only
   * @param opts - Optional configuration for local authentication
   * @returns Hono middleware handler
   */
  authenticateSessionLocal:
    (opts?: LocalMiddlewareOpts): MiddlewareHandler =>
    async (c, next) => {
      const stytchClient = B2B.getClient(c)

      const getCredential = opts?.getCredential ?? defaultSessionCredential

      try {
        const { member_session } = await stytchClient.sessions.authenticateJwt({
          ...getCredential(c),
          max_token_age_seconds: opts?.maxTokenAgeSeconds,
        })

        c.set('stytchB2BSession', member_session)
      } catch (error) {
        if (opts?.onError) {
          const result = opts.onError(c, error as Error)
          if (result) return result
        }
        throw new HTTPException(401, { message: 'Unauthenticated' })
      }

      await next()
    },

  /**
   * Creates middleware for remote B2B session authentication that validates with Stytch servers
   * @param opts - Optional configuration for remote authentication
   * @returns Hono middleware handler
   */
  authenticateSessionRemote:
    (opts?: OnlineMiddlewareOpts): MiddlewareHandler =>
    async (c, next) => {
      const stytchClient = B2B.getClient(c)

      const getCredential = opts?.getCredential ?? defaultSessionCredential

      try {
        const { member, member_session, organization } = await stytchClient.sessions.authenticate({
          ...getCredential(c),
        })

        c.set('stytchB2BSession', member_session)
        c.set('stytchB2BMember', member)
        c.set('stytchB2BOrganization', organization)
      } catch (error) {
        if (opts?.onError) {
          const result = opts.onError(c, error as Error)
          if (result) return result
        }
        throw new HTTPException(401, { message: 'Unauthenticated' })
      }

      await next()
    },

  /**
   * Retrieves the authenticated B2B member session from the request context
   * @param c - The Hono request context
   * @returns The B2B member session object
   * @throws Error if no session is found in context
   */
  getStytchSession: (c: Context): MemberSession => {
    const session = c.get('stytchB2BSession')
    if (!session) {
      throw Error(
        'No session in context. Was B2B.authenticateSessionLocal or B2B.authenticateSessionRemote called?'
      )
    }
    return session
  },

  /**
   * Retrieves the authenticated B2B member from the request context
   * @param c - The Hono request context
   * @returns The B2B member object
   * @throws Error if no member is found in context (only available after remote authentication)
   */
  getStytchMember: (c: Context): Member => {
    const member = c.get('stytchB2BMember')
    if (!member) {
      throw Error('No member in context. Was B2B.authenticateSessionRemote called?')
    }
    return member
  },

  /**
   * Retrieves the authenticated B2B organization from the request context
   * @param c - The Hono request context
   * @returns The B2B organization object
   * @throws Error if no organization is found in context (only available after remote authentication)
   */
  getStytchOrganization: (c: Context): Organization => {
    const organization = c.get('stytchB2BOrganization')
    if (!organization) {
      throw Error('No organization in context. Was B2B.authenticateSessionRemote called?')
    }
    return organization
  },

  /**
   * Creates middleware for B2B OAuth2 bearer token authentication
   * @param opts - Optional configuration for OAuth authentication
   * @returns Hono middleware handler
   */
  authenticateOAuthToken:
    (opts?: B2BOAuthMiddlewareOpts): MiddlewareHandler =>
    async (c, next) => {
      const stytchClient = B2B.getClient(c)

      try {
        const authHeader = c.req.header('Authorization')
        if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
          throw new Error('Missing or invalid access token')
        }
        const bearerToken = authHeader.substring(7)
        const claims = await stytchClient.idp.introspectTokenLocal(bearerToken)

        c.set('stytchB2BOAuthClaims', claims)
        c.set('stytchB2BOAuthToken', bearerToken)
      } catch (error) {
        if (opts?.onError) {
          opts.onError(c, error as Error)
        }
        throw new HTTPException(401, { message: 'Unauthenticated' })
      }

      await next()
    },

  /**
   * Retrieves the B2B OAuth data from the request context
   * @param c - The Hono request context
   * @returns Object containing OAuth token response and access token
   * @throws Error if no OAuth data is found in context
   */
  getOAuthData: (c: Context): { claims: B2BTokenClaims; token: string } => {
    const claims = c.get('stytchB2BOAuthClaims')
    const token = c.get('stytchB2BOAuthToken')
    if (!claims || !token) {
      throw Error('No B2B OAuth data in context. Was B2B.authenticateOAuthToken called?')
    }
    return { claims, token }
  },
}
