/**
 * OpenID Connect authentication middleware for hono
 */

import type { Context, MiddlewareHandler, OidcAuthClaims, TypedResponse } from 'hono'
import { env } from 'hono/adapter'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { sign, verify } from 'hono/jwt'
import * as oauth2 from 'oauth4webapi'

export type IDToken = oauth2.IDToken
export type TokenEndpointResponses =
  | oauth2.OpenIDTokenEndpointResponse
  | oauth2.TokenEndpointResponse
export type OidcClaimsHook = (
  orig: OidcAuth | undefined,
  claims: IDToken | undefined,
  response: TokenEndpointResponses
) => Promise<OidcAuthClaims>

declare module 'hono' {
  export interface OidcAuthClaims {
    readonly [claim: string]: oauth2.JsonValue | undefined
  }
  interface ContextVariableMap {
    oidcAuthEnv: OidcAuthEnv
    oidcAuthorizationServer: oauth2.AuthorizationServer
    oidcClient: oauth2.Client
    oidcAuth: OidcAuth | null
    oidcAuthJwt: string
    oidcClaimsHook?: OidcClaimsHook
  }
}

const defaultOidcRedirectUri = '/callback'
const defaultOidcAuthCookiePath = '/'
const defaultOidcAuthCookieName = 'oidc-auth'
const defaultRefreshInterval = 15 * 60 // 15 minutes
const defaultExpirationInterval = 60 * 60 * 24 // 1 day

export type OidcAuth = {
  rtk: string // refresh token
  rtkexp: number // token expiration time ; refresh token if it's expired
  ssnexp: number // session expiration time; if it's expired, revoke session and redirect to IdP
} & OidcAuthClaims

export type OidcAuthEnv = {
  OIDC_AUTH_SECRET: string
  OIDC_AUTH_REFRESH_INTERVAL?: string
  OIDC_AUTH_EXPIRES?: string
  OIDC_ISSUER: string
  OIDC_CLIENT_ID: string
  OIDC_CLIENT_SECRET: string
  OIDC_REDIRECT_URI?: string
  OIDC_SCOPES?: string
  OIDC_COOKIE_PATH?: string
  OIDC_COOKIE_NAME?: string
  OIDC_COOKIE_DOMAIN?: string
  OIDC_AUDIENCE?: string
  OIDC_AUTH_EXTERNAL_URL?: string
}

/**
 * Configure the OIDC variables programmatically.
 * If used, should be called before any other OIDC middleware or functions for the Hono context.
 * Unconfigured values will fallback to environment variables.
 */
export const initOidcAuthMiddleware = (config: Partial<OidcAuthEnv>): MiddlewareHandler => {
  return createMiddleware(async (c, next) => {
    setOidcAuthEnv(c, config)
    await next()
  })
}

/**
 * Configure the OIDC variables.
 */
const setOidcAuthEnv = (c: Context, config?: Partial<OidcAuthEnv>) => {
  const currentOidcAuthEnv = c.get('oidcAuthEnv')
  if (currentOidcAuthEnv !== undefined) {
    throw new HTTPException(500, { message: 'OIDC Auth env is already configured' })
  }
  const ev = env<Readonly<OidcAuthEnv>>(c)
  const oidcAuthEnv = {
    OIDC_AUTH_SECRET: config?.OIDC_AUTH_SECRET ?? ev.OIDC_AUTH_SECRET,
    OIDC_AUTH_REFRESH_INTERVAL: config?.OIDC_AUTH_REFRESH_INTERVAL ?? ev.OIDC_AUTH_REFRESH_INTERVAL,
    OIDC_AUTH_EXPIRES: config?.OIDC_AUTH_EXPIRES ?? ev.OIDC_AUTH_EXPIRES,
    OIDC_ISSUER: config?.OIDC_ISSUER ?? ev.OIDC_ISSUER,
    OIDC_CLIENT_ID: config?.OIDC_CLIENT_ID ?? ev.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: config?.OIDC_CLIENT_SECRET ?? ev.OIDC_CLIENT_SECRET,
    OIDC_REDIRECT_URI: config?.OIDC_REDIRECT_URI ?? ev.OIDC_REDIRECT_URI,
    OIDC_SCOPES: config?.OIDC_SCOPES ?? ev.OIDC_SCOPES,
    OIDC_COOKIE_PATH: config?.OIDC_COOKIE_PATH ?? ev.OIDC_COOKIE_PATH,
    OIDC_COOKIE_NAME: config?.OIDC_COOKIE_NAME ?? ev.OIDC_COOKIE_NAME,
    OIDC_COOKIE_DOMAIN: config?.OIDC_COOKIE_DOMAIN ?? ev.OIDC_COOKIE_DOMAIN,
    OIDC_AUDIENCE: config?.OIDC_AUDIENCE ?? ev.OIDC_AUDIENCE,
    OIDC_AUTH_EXTERNAL_URL: config?.OIDC_AUTH_EXTERNAL_URL ?? ev.OIDC_AUTH_EXTERNAL_URL,
  }
  if (oidcAuthEnv.OIDC_AUTH_SECRET === undefined) {
    throw new HTTPException(500, { message: 'Session secret is not provided' })
  }
  if (oidcAuthEnv.OIDC_AUTH_SECRET.length < 32) {
    throw new HTTPException(500, {
      message: 'Session secrets must be at least 32 characters long',
    })
  }
  if (oidcAuthEnv.OIDC_ISSUER === undefined) {
    throw new HTTPException(500, { message: 'OIDC issuer is not provided' })
  }
  if (oidcAuthEnv.OIDC_CLIENT_ID === undefined) {
    throw new HTTPException(500, { message: 'OIDC client ID is not provided' })
  }
  if (oidcAuthEnv.OIDC_CLIENT_SECRET === undefined) {
    throw new HTTPException(500, { message: 'OIDC client secret is not provided' })
  }
  oidcAuthEnv.OIDC_REDIRECT_URI = oidcAuthEnv.OIDC_REDIRECT_URI ?? defaultOidcRedirectUri
  if (!oidcAuthEnv.OIDC_REDIRECT_URI.startsWith('/')) {
    try {
      new URL(oidcAuthEnv.OIDC_REDIRECT_URI)
    } catch {
      throw new HTTPException(500, {
        message: 'The OIDC redirect URI is invalid. It must be a full URL or an absolute path',
      })
    }
  }
  if (oidcAuthEnv.OIDC_AUTH_EXTERNAL_URL) {
    try {
      new URL(oidcAuthEnv.OIDC_AUTH_EXTERNAL_URL)
    } catch {
      throw new HTTPException(500, {
        message: 'The OIDC external URL is invalid. It must be a full URL.',
      })
    }
  }
  oidcAuthEnv.OIDC_COOKIE_PATH = oidcAuthEnv.OIDC_COOKIE_PATH ?? defaultOidcAuthCookiePath
  oidcAuthEnv.OIDC_COOKIE_NAME = oidcAuthEnv.OIDC_COOKIE_NAME ?? defaultOidcAuthCookieName
  oidcAuthEnv.OIDC_AUTH_REFRESH_INTERVAL =
    oidcAuthEnv.OIDC_AUTH_REFRESH_INTERVAL ?? `${defaultRefreshInterval}`
  oidcAuthEnv.OIDC_AUTH_EXPIRES = oidcAuthEnv.OIDC_AUTH_EXPIRES ?? `${defaultExpirationInterval}`
  oidcAuthEnv.OIDC_SCOPES = oidcAuthEnv.OIDC_SCOPES ?? ''
  c.set('oidcAuthEnv', oidcAuthEnv)
}

/**
 * Returns the environment variables for OIDC-auth middleware.
 */
const getOidcAuthEnv = (c: Context) => {
  let oidcAuthEnv = c.get('oidcAuthEnv')
  if (oidcAuthEnv === undefined) {
    setOidcAuthEnv(c)
    oidcAuthEnv = c.get('oidcAuthEnv')
  }
  return oidcAuthEnv as Required<OidcAuthEnv>
}

/**
 * Returns the OAuth2 authorization server metadata.
 * If the metadata is not cached, it will be retrieved from the discovery endpoint.
 */
export const getAuthorizationServer = async (c: Context): Promise<oauth2.AuthorizationServer> => {
  const env = getOidcAuthEnv(c)
  let as = c.get('oidcAuthorizationServer')
  if (as === undefined) {
    const issuer = new URL(env.OIDC_ISSUER)
    const response = await oauth2.discoveryRequest(issuer)
    as = await oauth2.processDiscoveryResponse(issuer, response)
    c.set('oidcAuthorizationServer', as)
  }
  return as
}

/**
 * Returns the OAuth2 client metadata.
 */
export const getClient = (c: Context): oauth2.Client => {
  const env = getOidcAuthEnv(c)
  let client = c.get('oidcClient')
  if (client === undefined) {
    client = {
      client_id: env.OIDC_CLIENT_ID,
      client_secret: env.OIDC_CLIENT_SECRET,
      token_endpoint_auth_method: 'client_secret_basic',
    }
    c.set('oidcClient', client)
  }
  return client
}

/**
 * Validates and parses session JWT and returns the OIDC user metadata.
 * If the session is invalid or expired, revokes the session and returns null.
 */
export const getAuth = async (c: Context): Promise<OidcAuth | null> => {
  const env = getOidcAuthEnv(c)
  let auth = c.get('oidcAuth')
  if (auth === undefined) {
    const session_jwt = getCookie(c, env.OIDC_COOKIE_NAME)
    if (session_jwt === undefined) {
      return null
    }
    try {
      auth = (await verify(session_jwt, env.OIDC_AUTH_SECRET)) as OidcAuth
    } catch {
      deleteCookie(c, env.OIDC_COOKIE_NAME, { path: env.OIDC_COOKIE_PATH })
      return null
    }
    if (auth === null || auth.rtkexp === undefined || auth.ssnexp === undefined) {
      throw new HTTPException(500, { message: 'Invalid session' })
    }
    const now = Math.floor(Date.now() / 1000)
    // Revoke the session if it has expired
    if (auth.ssnexp < now) {
      revokeSession(c)
      return null
    }
    if (auth.rtkexp < now) {
      // Refresh the token if it has expired
      if (auth.rtk === undefined || auth.rtk === '') {
        deleteCookie(c, env.OIDC_COOKIE_NAME, { path: env.OIDC_COOKIE_PATH })
        return null
      }
      const as = await getAuthorizationServer(c)
      const client = getClient(c)
      const response = await oauth2.refreshTokenGrantRequest(as, client, auth.rtk)
      const result = await oauth2.processRefreshTokenResponse(as, client, response)
      if (oauth2.isOAuth2Error(result)) {
        // The refresh_token might be expired or revoked
        deleteCookie(c, env.OIDC_COOKIE_NAME, { path: env.OIDC_COOKIE_PATH })
        return null
      }
      auth = await updateAuth(c, auth, result)
    }
    c.set('oidcAuth', auth)
  }
  return auth
}

/**
 * Generates a new session JWT and sets the session cookie.
 */
const setAuth = async (
  c: Context,
  response: oauth2.OpenIDTokenEndpointResponse
): Promise<OidcAuth> => {
  return updateAuth(c, undefined, response)
}

/**
 * Updates the session JWT and sets the new session cookie.
 */
const updateAuth = async (
  c: Context,
  orig: OidcAuth | undefined,
  response: TokenEndpointResponses
): Promise<OidcAuth> => {
  const env = getOidcAuthEnv(c)
  const claims = oauth2.getValidatedIdTokenClaims(response)
  const authRefreshInterval = Number(env.OIDC_AUTH_REFRESH_INTERVAL)
  const authExpires = Number(env.OIDC_AUTH_EXPIRES)
  const claimsHook: OidcClaimsHook =
    c.get('oidcClaimsHook') ??
    (async (orig, claims) => {
      return {
        sub: claims?.sub || orig?.sub || '',
        email: (claims?.email as string) || orig?.email || '',
      }
    })
  const updated = {
    ...(await claimsHook(orig, claims, response)),
    rtk: response.refresh_token || orig?.rtk || '',
    rtkexp: Math.floor(Date.now() / 1000) + authRefreshInterval,
    ssnexp: orig?.ssnexp || Math.floor(Date.now() / 1000) + authExpires,
  }
  const session_jwt = await sign(updated, env.OIDC_AUTH_SECRET)
  const cookieOptions =
    env.OIDC_COOKIE_DOMAIN == null
      ? { path: env.OIDC_COOKIE_PATH, httpOnly: true, secure: true }
      : { path: env.OIDC_COOKIE_PATH, domain: env.OIDC_COOKIE_DOMAIN, httpOnly: true, secure: true }
  setCookie(c, env.OIDC_COOKIE_NAME, session_jwt, cookieOptions)
  c.set('oidcAuthJwt', session_jwt)
  return updated
}

/**
 * Revokes the refresh token of the current session and deletes the session cookie
 */
export const revokeSession = async (c: Context): Promise<void> => {
  const env = getOidcAuthEnv(c)
  const session_jwt = getCookie(c, env.OIDC_COOKIE_NAME)
  if (session_jwt !== undefined) {
    deleteCookie(c, env.OIDC_COOKIE_NAME, { path: env.OIDC_COOKIE_PATH })
    const auth = (await verify(session_jwt, env.OIDC_AUTH_SECRET)) as OidcAuth
    if (auth.rtk !== undefined && auth.rtk !== '') {
      // revoke refresh token
      const as = await getAuthorizationServer(c)
      const client = getClient(c)
      if (as.revocation_endpoint !== undefined) {
        const response = await oauth2.revocationRequest(as, client, auth.rtk)
        const result = await oauth2.processRevocationResponse(response)
        if (oauth2.isOAuth2Error(result)) {
          throw new HTTPException(500, {
            message: `OAuth2Error: [${result.error}] ${result.error_description}`,
          })
        }
      }
    }
  }
  c.set('oidcAuth', null)
}

/**
 * Generates the authorization request URL for the OpenID Connect flow.
 * @param c - The Hono context object.
 * @param state - The state parameter for CSRF protection.
 * @param nonce - The nonce parameter for replay attack protection.
 * @param code_challenge - The code challenge for PKCE (Proof Key for Code Exchange).
 * @returns The authorization request URL.
 * @throws Error if OpenID Connect or email scopes are not supported by the authorization server.
 */
const generateAuthorizationRequestUrl = async (
  c: Context,
  state: string,
  nonce: string,
  code_challenge: string
) => {
  const env = getOidcAuthEnv(c)
  const as = await getAuthorizationServer(c)
  const client = getClient(c)
  const authorizationRequestUrl = new URL(as.authorization_endpoint!)
  const redirectUri = new URL(env.OIDC_REDIRECT_URI, c.req.url).toString()
  authorizationRequestUrl.searchParams.set('client_id', client.client_id)
  authorizationRequestUrl.searchParams.set('redirect_uri', redirectUri)
  authorizationRequestUrl.searchParams.set('response_type', 'code')
  if (as.scopes_supported === undefined || as.scopes_supported.length === 0) {
    throw new HTTPException(500, {
      message: 'The supported scopes information is not provided by the IdP',
    })
  } else if (env.OIDC_SCOPES !== '') {
    for (const scope of env.OIDC_SCOPES.split(' ')) {
      if (as.scopes_supported.indexOf(scope) === -1) {
        throw new HTTPException(500, {
          message: `The '${scope}' scope is not supported by the IdP`,
        })
      }
    }
    authorizationRequestUrl.searchParams.set('scope', env.OIDC_SCOPES)
  } else {
    authorizationRequestUrl.searchParams.set('scope', as.scopes_supported.join(' '))
  }
  authorizationRequestUrl.searchParams.set('state', state)
  authorizationRequestUrl.searchParams.set('nonce', nonce)
  authorizationRequestUrl.searchParams.set('code_challenge', code_challenge)
  authorizationRequestUrl.searchParams.set('code_challenge_method', 'S256')
  if (as.issuer === 'https://accounts.google.com') {
    // Google requires 'access_type=offline' and 'prompt=consent' to obtain a refresh token
    authorizationRequestUrl.searchParams.set('access_type', 'offline')
    authorizationRequestUrl.searchParams.set('prompt', 'consent')
  }
  if (env.OIDC_AUDIENCE) {
    authorizationRequestUrl.searchParams.set('audience', env.OIDC_AUDIENCE)
  }
  return authorizationRequestUrl.toString()
}

/**
 * Processes the OAuth2 callback request.
 */
export const processOAuthCallback = async (
  c: Context
): Promise<Response & TypedResponse<undefined, 302, 'redirect'>> => {
  const env = getOidcAuthEnv(c)
  const as = await getAuthorizationServer(c)
  const client = getClient(c)

  // Parses the authorization response and validates the state parameter
  const state = getCookie(c, 'state')
  const path = new URL(env.OIDC_REDIRECT_URI, c.req.url).pathname
  deleteCookie(c, 'state', { path })
  const currentUrl: URL = new URL(c.req.url)
  const params = oauth2.validateAuthResponse(as, client, currentUrl, state)
  if (oauth2.isOAuth2Error(params)) {
    throw new HTTPException(500, {
      message: `OAuth2Error: [${params.error}] ${params.error_description}`,
    })
  }

  // Exchanges the authorization code for a refresh token
  const code = c.req.query('code')
  const nonce = getCookie(c, 'nonce')
  deleteCookie(c, 'nonce', { path })
  const code_verifier = getCookie(c, 'code_verifier')
  deleteCookie(c, 'code_verifier', { path })
  const continue_url = getCookie(c, 'continue')
  deleteCookie(c, 'continue', { path })
  if (code === undefined || nonce === undefined || code_verifier === undefined) {
    throw new HTTPException(500, { message: 'Missing required parameters / cookies' })
  }
  const redirectUri = new URL(env.OIDC_REDIRECT_URI, c.req.url).toString()
  const result = await exchangeAuthorizationCode(
    as,
    client,
    params,
    redirectUri,
    nonce,
    code_verifier
  )
  await setAuth(c, result)
  return c.redirect(continue_url || '/')
}

/**
 * Exchanges the authorization code for a refresh token.
 */
const exchangeAuthorizationCode = async (
  as: oauth2.AuthorizationServer,
  client: oauth2.Client,
  params: URLSearchParams,
  redirect_uri: string,
  nonce: string,
  code_verifier: string
) => {
  const response = await oauth2.authorizationCodeGrantRequest(
    as,
    client,
    params,
    redirect_uri,
    code_verifier
  )
  // Handle www-authenticate challenges
  const challenges = oauth2.parseWwwAuthenticateChallenges(response)
  if (challenges !== undefined) {
    throw new HTTPException(500, {
      message: `www-authenticate error: ${JSON.stringify(challenges)}`,
    })
  }
  const result = await oauth2.processAuthorizationCodeOpenIDResponse(as, client, response, nonce)
  if (oauth2.isOAuth2Error(result)) {
    throw new HTTPException(500, {
      message: `OAuth2Error: [${result.error}] ${result.error_description}`,
    })
  }
  return result
}

/**
 * Returns a middleware that requires OIDC authentication.
 */
export const oidcAuthMiddleware = (): MiddlewareHandler => {
  return createMiddleware(async (c, next) => {
    const env = getOidcAuthEnv(c)
    const uri = new URL(c.req.url)
    const redirectUri = new URL(env.OIDC_REDIRECT_URI, c.req.url)
    if (uri.pathname === redirectUri.pathname && uri.origin === redirectUri.origin) {
      return processOAuthCallback(c)
    }
    try {
      const auth = await getAuth(c)
      if (auth === null) {
        const path = new URL(env.OIDC_REDIRECT_URI, c.req.url).pathname
        const cookieDomain = env.OIDC_COOKIE_DOMAIN
        // Redirect to IdP for login
        const state = oauth2.generateRandomState()
        const nonce = oauth2.generateRandomNonce()
        const code_verifier = oauth2.generateRandomCodeVerifier()
        const code_challenge = await oauth2.calculatePKCECodeChallenge(code_verifier)
        const url = await generateAuthorizationRequestUrl(c, state, nonce, code_challenge)
        const cookieOptions =
          cookieDomain == null
            ? { path, httpOnly: true, secure: true }
            : { path, domain: cookieDomain, httpOnly: true, secure: true }
        setCookie(c, 'state', state, cookieOptions)
        setCookie(c, 'nonce', nonce, cookieOptions)
        setCookie(c, 'code_verifier', code_verifier, cookieOptions)
        const continueUrl = env.OIDC_AUTH_EXTERNAL_URL
          ? (() => {
              const externalUrl = new URL(env.OIDC_AUTH_EXTERNAL_URL)
              const originalUrl = new URL(c.req.url)
              externalUrl.pathname = `${externalUrl.pathname.replace(/\/$/, '')}${
                originalUrl.pathname
              }`
              externalUrl.search = originalUrl.search
              externalUrl.hash = originalUrl.hash
              return externalUrl.toString()
            })()
          : c.req.url
        setCookie(c, 'continue', continueUrl, cookieOptions)
        return c.redirect(url)
      }
    } catch {
      deleteCookie(c, env.OIDC_COOKIE_NAME, { path: env.OIDC_COOKIE_PATH })
      throw new HTTPException(500, { message: 'Invalid session' })
    }
    await next()
    c.res.headers.set('Cache-Control', 'private, no-cache')
    // Workaround to set the session cookie when the response is returned by the origin server
    const session_jwt = c.get('oidcAuthJwt')
    if (session_jwt !== undefined) {
      setCookie(c, env.OIDC_COOKIE_NAME, session_jwt, {
        path: env.OIDC_COOKIE_PATH,
        httpOnly: true,
        secure: true,
      })
    }
  })
}
