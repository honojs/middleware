import { InvalidGrantError, InvalidRequestError, OAuthError, ServerError, TooManyRequestsError, UnsupportedGrantTypeError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import type { ConfigType as RateLimitOptions } from "hono-rate-limiter";
import { verifyChallenge } from "pkce-challenge";
import { z } from "zod";
import { authenticateClient } from "../middleware/clientAuth.js";


export type TokenHandlerOptions = {
  provider: OAuthServerProvider;
  /**
   * Rate limiting configuration for the token endpoint.
   * Set to false to disable rate limiting for this endpoint.
   */
  rateLimit?: Partial<RateLimitOptions> | false;
};

const TokenRequestSchema = z.object({
  grant_type: z.string(),
});

const AuthorizationCodeGrantSchema = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string().optional(),
  resource: z.string().url().optional(),
});

const RefreshTokenGrantSchema = z.object({
  refresh_token: z.string(),
  scope: z.string().optional(),
  resource: z.string().url().optional(),
});

export function tokenHandler({ provider, rateLimit: rateLimitConfig }: TokenHandlerOptions): Hono {
  // Nested router so we can configure middleware and restrict HTTP method
  const router = new Hono();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  // Apply rate limiting unless explicitly disabled
  if (rateLimitConfig !== false) {
    router.use(rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 50, // 50 requests per windowMs 
      standardHeaders: true,
      keyGenerator: () => "some-unique-key",
      message: new TooManyRequestsError('You have exceeded the rate limit for token requests').toResponseObject(),
      ...rateLimitConfig
    }));
  }

  // Authenticate and extract client details
  router.use(authenticateClient({ clientsStore: provider.clientsStore }));

  router.post("/", async (c) => {
    c.header("Cache-Control", "no-store");

    try {
      const parseResult = TokenRequestSchema.safeParse(await c.req.json());
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message);
      }

      const { grant_type } = parseResult.data;

      const client = c.get("client");
      if (!client) {
        // This should never happen
        throw new ServerError("Internal Server Error");
      }

      switch (grant_type) {
        case "authorization_code": {
          const parseResult = AuthorizationCodeGrantSchema.safeParse(await c.req.json());
          if (!parseResult.success) {
            throw new InvalidRequestError(parseResult.error.message);
          }

          const { code, code_verifier, redirect_uri, resource } = parseResult.data;

          const skipLocalPkceValidation = provider.skipLocalPkceValidation;

          // Perform local PKCE validation unless explicitly skipped 
          // (e.g. to validate code_verifier in upstream server)
          if (!skipLocalPkceValidation) {
            const codeChallenge = await provider.challengeForAuthorizationCode(client, code);
            if (!(await verifyChallenge(code_verifier, codeChallenge))) {
              throw new InvalidGrantError("code_verifier does not match the challenge");
            }
          }

          // Passes the code_verifier to the provider if PKCE validation didn't occur locally
          const tokens = await provider.exchangeAuthorizationCode(
            client,
            code,
            skipLocalPkceValidation ? code_verifier : undefined,
            redirect_uri,
            resource ? new URL(resource) : undefined
          );
          return c.json(tokens, 200);
          break;
        }

        case "refresh_token": {
          const parseResult = RefreshTokenGrantSchema.safeParse(await c.req.json());
          if (!parseResult.success) {
            throw new InvalidRequestError(parseResult.error.message);
          }

          const { refresh_token, scope, resource } = parseResult.data;

          const scopes = scope?.split(" ");
          const tokens = await provider.exchangeRefreshToken(client, refresh_token, scopes, resource ? new URL(resource) : undefined);
          return c.json(tokens);
          break;
        }

        // Not supported right now
        //case "client_credentials":

        default:
          throw new UnsupportedGrantTypeError(
            "The grant type is not supported by this authorization server."
          );
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        return c.json(error.toResponseObject(), status);
      } else {
        const serverError = new ServerError("Internal Server Error");
        return c.json(serverError.toResponseObject(), 500);
      }
    }
  });

  return router;
}