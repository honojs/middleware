import {
  InvalidGrantError,
  InvalidRequestError,
  OAuthError,
  ServerError,
  UnsupportedGrantTypeError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { MiddlewareHandler } from 'hono'
import { verifyChallenge } from 'pkce-challenge'
import { z } from 'zod'
import type { ClientAuthenticationEnv } from '../middleware/client-auth'

const TokenRequestSchema = z.object({
  grant_type: z.string(),
})

const AuthorizationCodeGrantSchema = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string().optional(),
  resource: z.string().url().optional(),
})

const RefreshTokenGrantSchema = z.object({
  refresh_token: z.string(),
  scope: z.string().optional(),
  resource: z.string().url().optional(),
})

export function tokenHandler(
  provider: OAuthServerProvider
): MiddlewareHandler<ClientAuthenticationEnv> {
  return async (c) => {
    c.header('Cache-Control', 'no-store')

    try {
      const parseResult = TokenRequestSchema.safeParse(await c.req.json())
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message)
      }

      const { grant_type } = parseResult.data

      const client = c.get('client')
      if (!client) {
        // This should never happen
        throw new ServerError('Internal Server Error')
      }

      switch (grant_type) {
        case 'authorization_code': {
          const parseResult = AuthorizationCodeGrantSchema.safeParse(await c.req.json())
          if (!parseResult.success) {
            throw new InvalidRequestError(parseResult.error.message)
          }

          const { code, code_verifier, redirect_uri, resource } = parseResult.data

          const skipLocalPkceValidation = provider.skipLocalPkceValidation

          // Perform local PKCE validation unless explicitly skipped
          // (e.g. to validate code_verifier in upstream server)
          if (!skipLocalPkceValidation) {
            const codeChallenge = await provider.challengeForAuthorizationCode(client, code)
            if (!(await verifyChallenge(code_verifier, codeChallenge))) {
              throw new InvalidGrantError('code_verifier does not match the challenge')
            }
          }

          // Passes the code_verifier to the provider if PKCE validation didn't occur locally
          const tokens = await provider.exchangeAuthorizationCode(
            client,
            code,
            skipLocalPkceValidation ? code_verifier : undefined,
            redirect_uri,
            resource ? new URL(resource) : undefined
          )
          return c.json(tokens, 200)
        }

        case 'refresh_token': {
          const parseResult = RefreshTokenGrantSchema.safeParse(await c.req.json())
          if (!parseResult.success) {
            throw new InvalidRequestError(parseResult.error.message)
          }

          const { refresh_token, scope, resource } = parseResult.data

          const scopes = scope?.split(' ')
          const tokens = await provider.exchangeRefreshToken(
            client,
            refresh_token,
            scopes,
            resource ? new URL(resource) : undefined
          )
          return c.json(tokens)
        }

        // Not supported right now
        //case "client_credentials":

        default:
          throw new UnsupportedGrantTypeError(
            'The grant type is not supported by this authorization server.'
          )
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400
        return c.json(error.toResponseObject(), status)
      }

      const serverError = new ServerError('Internal Server Error')
      return c.json(serverError.toResponseObject(), 500)
    }
  }
}
