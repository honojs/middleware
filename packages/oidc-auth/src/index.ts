/**
 * OpenID Connect authentication middleware for hono
 */

import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import { HTTPException } from 'hono/http-exception'
import * as oauth2 from 'oauth4webapi'

declare module 'hono' {
  interface ContextVariableMap {
    oidcAuthConfiguration: OidcAuthConfigration
    oidcAuthorizationServer : Promise<oauth2.AuthorizationServer>
    oidcClient: oauth2.Client
    oidcAuth: OidcAuth| null
    oidcSessionCookie: string
  }
}

export type OidcAuth = {
  sub: string
  email: string
  rtk: string // refresh token
  rtkexp: number // token expiration time ; refresh token if it's expired
  ssnexp: number // session expiration time; if it's expired, revoke session and redirect to IdP
}

const oidcAuthSessionCookieName = 'oidc-auth'
const defaultRefreshInterval = 15 * 60 // 15 minutes
const defaultExpirationInterval = 60 * 60 * 24 // 1 day

export type OidcAuthConfigration = {
  sessionSecret: string,
  sessionRefreshInterval?: number,
  sessionExpires?: number,
  issuer: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
}

let oidcAuthConfiguration: OidcAuthConfigration | null = null

/**
 * Configures the OIDC authentication middleware.
 * @param config - The OIDC-auth configuration.
 */
export const configureOidcAuth = (config: OidcAuthConfigration) => {
  oidcAuthConfiguration = config
}

/**
 * Returns the OIDC-auth configuration.
 */
export const getConfiguration = (c: Context): OidcAuthConfigration => {
  let config = c.get('oidcAuthConfiguration')
  if (config === undefined) {
    if (oidcAuthConfiguration === null) {
      throw new HTTPException(500, { message: 'OIDC configuration is not set' })
    }
    config = oidcAuthConfiguration
    if (config.sessionSecret.length < 32) {
      // RFC7518 requires the key to be at least 32 characters long for HS256
      // see: https://datatracker.ietf.org/doc/html/rfc7518#section-3.2
      throw new HTTPException(500, { message: 'The session secret must be at least 32 characters long' })
    }
    config.sessionRefreshInterval = config.sessionRefreshInterval || defaultRefreshInterval
    config.sessionExpires = config.sessionExpires || defaultExpirationInterval
    c.set('oidcAuthConfiguration', config)
  }
  return config
}

/**
 * Returns the OAuth2 authorization server metadata.
 * If the metadata is not cached, it will be retrieved from the discovery endpoint.
 */
export const getAuthorizationServer = async (c: Context) : Promise<oauth2.AuthorizationServer> => {
  const config = getConfiguration(c)
  let as = await c.get('oidcAuthorizationServer')
  if (as === undefined) {
    const issuer = new URL(config.issuer)
    const response = await oauth2.discoveryRequest(issuer)
    as = await oauth2.processDiscoveryResponse(issuer, response)
    c.set('oidcAuthorizationServer', as)
  }
  return as
}

/**
 * Returns the OAuth2 client metadata.
 */
export const getClient = (c: Context) : oauth2.Client => {
  const config = getConfiguration(c)
  let client = c.get('oidcClient')
  if (client === undefined) {
    client = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
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
  const config = getConfiguration(c)
  let auth = c.get('oidcAuth')
  if (auth === undefined) {
    const session_jwt = getCookie(c, oidcAuthSessionCookieName)
    if (session_jwt === undefined) {
      return null
    }
    try {
      auth = await verify(session_jwt, config.sessionSecret)
    } catch (e) {
      deleteCookie(c, oidcAuthSessionCookieName)
      return null
    }
    if (auth === null || auth.rtkexp === undefined || auth.ssnexp === undefined) {
      throw new HTTPException(500, { message: 'Invalid session' })
    }
    const now = Math.floor(Date.now() / 1000);
    // Revoke the session if it has expired
    if (auth.ssnexp < now) {
      revokeSession(c)
      return null
    }
    if (auth.rtkexp < now) {
      // Refresh the token if it has expired
      if (auth.rtk === undefined || auth.rtk === "") {
        deleteCookie(c, oidcAuthSessionCookieName)
        return null
      }
      const as = await getAuthorizationServer(c)
      const client = getClient(c)
      const response = await oauth2.refreshTokenGrantRequest(as, client, auth.rtk)
      const result = await oauth2.processRefreshTokenResponse(as, client, response)
      if (oauth2.isOAuth2Error(result)) {
        // The refresh_token might be expired or revoked
        deleteCookie(c, oidcAuthSessionCookieName)
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
const setAuth = async (c: Context, response: oauth2.OpenIDTokenEndpointResponse): Promise<OidcAuth> => {
  return updateAuth(c, undefined, response)
}

/**
 * Updates the session JWT and sets the new session cookie.
 */
const updateAuth = async (c: Context, orig: OidcAuth | undefined, response: oauth2.OpenIDTokenEndpointResponse | oauth2.TokenEndpointResponse): Promise<OidcAuth> => {
  const config = getConfiguration(c)
  const claims = oauth2.getValidatedIdTokenClaims(response)
  const updated: OidcAuth = {
    sub: claims?.sub || orig?.sub || '',
    email: claims?.email as string || orig?.email || '',
    rtk: response.refresh_token || orig?.rtk || '',
    rtkexp: Math.floor(Date.now() / 1000) + config.sessionRefreshInterval!,
    ssnexp: orig?.ssnexp || Math.floor(Date.now() / 1000) + config.sessionExpires!,
  }
  const session_jwt = await sign(updated, config.sessionSecret)
  setCookie(c, oidcAuthSessionCookieName, session_jwt, { path: '/', httpOnly: true, secure: true })
  c.set('oidcSessionCookie', session_jwt)
  return updated
}

/**
 * Revokes the refresh token of the current session and deletes the session cookie
 */
export const revokeSession = async (c: Context): Promise<void> => {
  const config = getConfiguration(c)
  const session_jwt = getCookie(c, oidcAuthSessionCookieName)
  if (session_jwt !== undefined) {
    deleteCookie(c, oidcAuthSessionCookieName)
    const auth: OidcAuth = await verify(session_jwt, config.sessionSecret)
    if (auth.rtk !== undefined && auth.rtk !== "") {
      // revoke refresh token
      const as = await getAuthorizationServer(c)
      const client = getClient(c)
      if (as.revocation_endpoint !== undefined) {
        const response = await oauth2.revocationRequest(as, client, auth.rtk)
        const result = await oauth2.processRevocationResponse(response)
        if (oauth2.isOAuth2Error(result)) {
          throw new HTTPException(500, { message: `OAuth2Error: [${result.error}] ${result.error_description}` })
        }
      }
    }
  }
  c.set('oidcAuth', undefined)
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
const generateAuthorizationRequestUrl = async (c: Context, state: string, nonce: string, code_challenge: string) => {
  const config = getConfiguration(c)
  const as = await getAuthorizationServer(c)
  const client = getClient(c)
  const authorizationRequestUrl = new URL(as.authorization_endpoint!)
  authorizationRequestUrl.searchParams.set('client_id', client.client_id)
  authorizationRequestUrl.searchParams.set('redirect_uri', config.redirectUri)
  authorizationRequestUrl.searchParams.set('response_type', 'code')
  if (as.scopes_supported === undefined || as.scopes_supported.length === 0) {
    throw new HTTPException(500, { message: 'The supported scopes information is not provided by the IdP' })
  } else if (as.scopes_supported.indexOf('email') === -1) {
    throw new HTTPException(500, { message: 'The "email" scope is not supported by the IdP' })
  } else if (as.scopes_supported.indexOf('offline_access') === -1) {
    authorizationRequestUrl.searchParams.set('scope', 'openid email')
  } else {
    authorizationRequestUrl.searchParams.set('scope', 'openid email offline_access')
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
  return authorizationRequestUrl.toString()
}

/**
 * Processes the OAuth2 callback request.
 */
export const processOAuthCallback = async (c: Context) => {
  const config = getConfiguration(c)
  const as = await getAuthorizationServer(c)
  const client = getClient(c)

  // Parses the authorization response and validates the state parameter
  const state = getCookie(c, 'state')
  deleteCookie(c, 'state')
  const currentUrl: URL = new URL(c.req.url)
  const params = oauth2.validateAuthResponse(as, client, currentUrl, state)
  if (oauth2.isOAuth2Error(params)) {
    throw new HTTPException(500, { message: `OAuth2Error: [${params.error}] ${params.error_description}` })
  }

  // Exchanges the authorization code for a refresh token
  const code = c.req.query('code')
  const nonce = getCookie(c, 'nonce')
  deleteCookie(c, 'nonce')
  const code_verifier = getCookie(c, 'code_verifier')
  deleteCookie(c, 'code_verifier')
  const continue_url = getCookie(c, 'continue')
  deleteCookie(c, 'continue')
  if (code === undefined || nonce === undefined || code_verifier === undefined) {
    throw new HTTPException(500, { message: 'Missing required parameters / cookies' })
  }
  const result = await exchangeAuthorizationCode(as, client, params, config.redirectUri, nonce, code_verifier)
  await setAuth(c, result)
  return c.redirect(continue_url || '/')
}

/**
 * Exchanges the authorization code for a refresh token.
 */
const exchangeAuthorizationCode = async (as: oauth2.AuthorizationServer, client: oauth2.Client, params: URLSearchParams, redirect_uri: string, nonce: string, code_verifier: string) => {
  const response = await oauth2.authorizationCodeGrantRequest(
    as,
    client,
    params,
    redirect_uri,
    code_verifier,
  )
  // Handle www-authenticate challenges
  const challenges = oauth2.parseWwwAuthenticateChallenges(response)
  if (challenges !== undefined) {
    throw new HTTPException(500, { message: `www-authenticate error: ${JSON.stringify(challenges)}` })
  }
  const result = await oauth2.processAuthorizationCodeOpenIDResponse(as, client, response, nonce)
  if (oauth2.isOAuth2Error(result)) {
    throw new HTTPException(500, { message: `OAuth2Error: [${result.error}] ${result.error_description}` })
  }
  return result
}

/**
 * Returns a middleware that requires OIDC authentication.
 */
export const oidcAuthMiddleware = ()  => {
  return createMiddleware(async (c, next) => {
    const config = getConfiguration(c)
    const uri = c.req.url.split('?')[0]
    if (uri === config.redirectUri) {
      return processOAuthCallback(c)
    }
    try {
      const auth = await getAuth(c)
      if (auth === null) {
        // Redirect to IdP for login
        const state = oauth2.generateRandomState()
        const nonce = oauth2.generateRandomNonce()
        const code_verifier = oauth2.generateRandomCodeVerifier()
        const code_challenge = await oauth2.calculatePKCECodeChallenge(code_verifier)
        const url = await generateAuthorizationRequestUrl(c, state, nonce, code_challenge)
        setCookie(c, 'state', state, { path: '/' , httpOnly: true, secure: true})
        setCookie(c, 'nonce', nonce, { path: '/' , httpOnly: true, secure: true})
        setCookie(c, 'code_verifier', code_verifier, { path: '/' , httpOnly: true, secure: true})
        setCookie(c, 'continue', c.req.url, { path: '/' , httpOnly: true, secure: true})
        return c.redirect(url)
      }
    } catch (e) {
      console.log(e)
      deleteCookie(c, oidcAuthSessionCookieName)
      throw new HTTPException(500, { message: 'Invalid session' })
    }
    await next()
    c.res.headers.set('Cache-Control', 'private, no-cache')
    // Workaround to set the session cookie when the response is returned by the origin server
    const sessionCookie = c.get('oidcSessionCookie')
    if (sessionCookie !== undefined) {
      setCookie(c, oidcAuthSessionCookieName, sessionCookie, { path: '/', httpOnly: true, secure: true })
    }
  })
}