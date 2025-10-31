import {
  InvalidClientError,
  InvalidRequestError,
  InvalidScopeError,
  OAuthError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

// Parameters that must be validated in order to issue redirects.
const ClientAuthorizationParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z
    .string()
    .optional()
    .refine((value) => value === undefined || URL.canParse(value), {
      message: 'redirect_uri must be a valid URL',
    }),
})

// Parameters that must be validated for a successful authorization request. Failure can be reported to the redirect URI.
const RequestAuthorizationParamsSchema = z.object({
  response_type: z.literal('code'),
  code_challenge: z.string(),
  code_challenge_method: z.literal('S256'),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().url().optional(),
})

export function authorizeHandler(provider: OAuthServerProvider): MiddlewareHandler {
  return async (c) => {
    c.header('Cache-Control', 'no-store')

    // In the authorization flow, errors are split into two categories:
    // 1. Pre-redirect errors (direct response with 400)
    // 2. Post-redirect errors (redirect with error parameters)

    // Phase 1: Validate client_id and redirect_uri. Any errors here must be direct responses.
    let redirect_uri, client
    try {
      const result = ClientAuthorizationParamsSchema.safeParse(
        c.req.method === 'POST' ? await c.req.json() : c.req.query()
      )

      if (!result.success) {
        throw new InvalidRequestError(result.error.message)
      }

      redirect_uri = result.data.redirect_uri

      client = await provider.clientsStore.getClient(result.data.client_id)

      if (!client) {
        throw new InvalidClientError('Invalid client_id')
      }

      if (redirect_uri !== undefined) {
        if (!client.redirect_uris.includes(redirect_uri)) {
          throw new InvalidRequestError('Unregistered redirect_uri')
        }
      } else if (client.redirect_uris.length === 1) {
        redirect_uri = client.redirect_uris[0]
      } else {
        throw new InvalidRequestError(
          'redirect_uri must be specified when client has multiple registered URIs'
        )
      }
    } catch (error) {
      // Pre-redirect errors - return direct response
      //
      // These don't need to be JSON encoded, as they'll be displayed in a user
      // agent, but OTOH they all represent exceptional situations (arguably,
      // "programmer error"), so presenting a nice HTML page doesn't help the
      // user anyway.
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400
        return c.json(error.toResponseObject(), status)
      }

      const serverError = new ServerError('Internal Server Error')
      return c.json(serverError.toResponseObject(), 500)
    }

    // Phase 2: Validate other parameters. Any errors here should go into redirect responses.
    let state
    try {
      // Parse and validate authorization parameters
      const parseResult = RequestAuthorizationParamsSchema.safeParse(
        c.req.method === 'POST' ? await c.req.json() : c.req.query()
      )

      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message)
      }

      const { scope, code_challenge, resource } = parseResult.data
      state = parseResult.data.state

      // Validate scopes
      let requestedScopes: string[] = []
      if (scope !== undefined) {
        requestedScopes = scope.split(' ')
        const allowedScopes = new Set(client.scope?.split(' '))

        // Check each requested scope against allowed scopes
        for (const scope of requestedScopes) {
          if (!allowedScopes.has(scope)) {
            throw new InvalidScopeError(`Client was not registered with scope ${scope}`)
          }
        }
      }

      // All validation passed, proceed with authorization
      await provider.authorize(
        client,
        {
          state,
          scopes: requestedScopes,
          redirectUri: redirect_uri,
          codeChallenge: code_challenge,
          resource: resource ? new URL(resource) : undefined,
        },
        c
      )

      return c.res
    } catch (error) {
      // Post-redirect errors - redirect with error parameters
      if (error instanceof OAuthError) {
        return c.redirect(createErrorRedirect(redirect_uri, error, state))
      }

      const serverError = new ServerError('Internal Server Error')
      return c.redirect(createErrorRedirect(redirect_uri, serverError, state), 302)
    }
  }
}

/**
 * Helper function to create redirect URL with error parameters
 */
function createErrorRedirect(redirectUri: string, error: OAuthError, state?: string): string {
  const errorUrl = new URL(redirectUri)
  errorUrl.searchParams.set('error', error.errorCode)
  errorUrl.searchParams.set('error_description', error.message)
  if (error.errorUri) {
    errorUrl.searchParams.set('error_uri', error.errorUri)
  }
  if (state) {
    errorUrl.searchParams.set('state', state)
  }
  return errorUrl.href
}
