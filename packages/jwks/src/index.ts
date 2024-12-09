import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import jose from 'jose'

type JWKSResult = {
  readonly payload: any
  readonly token: any
}

// This is a declaration merging for the ContextVariableMap interface to add a new key 'jwks' with the type JWKSResult
declare module 'hono' {
  interface ContextVariableMap {
    jwks: JWKSResult
  }
}

type JWKSOptions = {
  readonly certsUrl: string | URL
  readonly policyIssuer: string
  readonly policyAudience: string
  readonly tokenSource?: (c: Context) => string | undefined
  readonly headerName?: string
}

/**
 * Middleware function to validate JSON Web Tokens (JWT) using JSON Web Key Sets (JWKS).
 *
 * @param {JWKSOptions} options - Configuration options for the JWKS middleware.
 * @param {string | URL} options.certsUrl - The URL to fetch the JWKS from.
 * @param {string} options.policyIssuer - The expected issuer of the JWT.
 * @param {string} options.policyAudience - The expected audience of the JWT.
 * @param {string} [options.headerName='cf-access-jwt-assertion'] - The name of the header containing the JWT.
 * @param {function} [options.tokenSource] - A function to extract the token from the request context.
 *
 * @throws {Error} Throws an error if required options are missing.
 * @throws {HTTPException} Throws an HTTPException if the JWT is missing or invalid.
 *
 * @returns {function} Returns a middleware function to be used in the request pipeline.
 */
export const jwks = (options: JWKSOptions) => {
  if (!options) {
    throw new Error('Missing options')
  }

  if (!options.certsUrl) {
    throw new Error('Missing certsUrl')
  }

  if (!options.policyIssuer) {
    throw new Error('Missing policyIssuer')
  }

  if (!options.policyAudience) {
    throw new Error('Missing policyAudience')
  }

  let certsUrl: URL
  if (typeof options.certsUrl === 'string') {
    certsUrl = new URL(options.certsUrl)
  } else {
    certsUrl = options.certsUrl
  }

  const JWKS = jose.createRemoteJWKSet(certsUrl)

  return createMiddleware(async (c, next) => {
    const headerName = options.headerName || 'cf-access-jwt-assertion'
    const tokenSource = options.tokenSource || ((c) => c.req.header(headerName))

    const token = tokenSource(c)
    if (!token) {
      const res = new Response('Missing Required Authorization Token', {
        headers: c.res.headers,
        status: 403,
      })
      throw new HTTPException(403, { res })
    }

    try {
      const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer: options.policyIssuer,
        audience: options.policyAudience,
      })
      c.set('jwks', { payload, token })
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown Error')
      const res = new Response(error.message, {
        headers: c.res.headers,
        status: 401,
      })
      throw new HTTPException(401, { res })
    }

    await next()
  })
}
