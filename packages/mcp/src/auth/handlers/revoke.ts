import { InvalidRequestError, OAuthError, ServerError, TooManyRequestsError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthTokenRevocationRequestSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import type { ConfigType as RateLimitOptions } from "hono-rate-limiter";
import { authenticateClient } from "../middleware/clientAuth.js";

export type RevocationHandlerOptions = {
  provider: OAuthServerProvider;
  /**
   * Rate limiting configuration for the token revocation endpoint.
   * Set to false to disable rate limiting for this endpoint.
   */
  rateLimit?: Partial<RateLimitOptions> | false;
};

export function revocationHandler({
  provider,
  rateLimit: rateLimitConfig,
}: RevocationHandlerOptions): Hono {
  if (!provider.revokeToken) {
    throw new Error("Auth provider does not support revoking tokens");
  }

  // Nested router so we can configure middleware and restrict HTTP method
  const router = new Hono();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  // Apply rate limiting unless explicitly disabled
  if (rateLimitConfig !== false) {
    router.use(
      rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 50, // 50 requests per windowMs
        standardHeaders: true,
        keyGenerator: () => "some-unique-key",
        message: new TooManyRequestsError(
          "You have exceeded the rate limit for token revocation requests"
        ).toResponseObject(),
        ...rateLimitConfig,
      })
    );
  }

  // Authenticate and extract client details
  router.use(authenticateClient({ clientsStore: provider.clientsStore }));

  router.post("/", async (c) => {
    c.header("Cache-Control", "no-store");

    try {
      const parseResult = OAuthTokenRevocationRequestSchema.safeParse(await c.req.json());
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message);
      }

      const client = c.get("client");
      if (!client) {
        // This should never happen
        throw new ServerError("Internal Server Error");
      }

      await provider.revokeToken!(client, parseResult.data);
      return c.json({});
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
