import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidClientMetadataError, OAuthError, ServerError, TooManyRequestsError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { OAuthClientMetadataSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import type { ConfigType as RateLimitOptions } from "hono-rate-limiter";
import crypto from "node:crypto";

export type ClientRegistrationHandlerOptions = {
  /**
   * A store used to save information about dynamically registered OAuth clients.
   */
  clientsStore: OAuthRegisteredClientsStore;

  /**
   * The number of seconds after which to expire issued client secrets, or 0 to prevent expiration of client secrets (not recommended).
   * 
   * If not set, defaults to 30 days.
   */
  clientSecretExpirySeconds?: number;

  /**
   * Rate limiting configuration for the client registration endpoint.
   * Set to false to disable rate limiting for this endpoint.
   * Registration endpoints are particularly sensitive to abuse and should be rate limited.
   */
  rateLimit?: Partial<RateLimitOptions> | false;

  /**
   * Whether to generate a client ID before calling the client registration endpoint.
   *
   * If not set, defaults to true.
   */
  clientIdGeneration?: boolean;
};

const DEFAULT_CLIENT_SECRET_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function clientRegistrationHandler({
  clientsStore,
  clientSecretExpirySeconds = DEFAULT_CLIENT_SECRET_EXPIRY_SECONDS,
  rateLimit: rateLimitConfig,
  clientIdGeneration = true,
}: ClientRegistrationHandlerOptions): Hono {
  if (!clientsStore.registerClient) {
    throw new Error("Client registration store does not support registering clients");
  }

  // Nested router so we can configure middleware and restrict HTTP method
  const router = new Hono();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  // Apply rate limiting unless explicitly disabled - stricter limits for registration
  if (rateLimitConfig !== false) {
    router.use(rateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      limit: 20, // 20 requests per hour - stricter as registration is sensitive
      standardHeaders: true,
      keyGenerator: () => "some-unique-key",
      message: new TooManyRequestsError('You have exceeded the rate limit for client registration requests').toResponseObject(),
      ...rateLimitConfig
    }));
  }

  router.post("/", async (c) => {
    c.header("Cache-Control", "no-store");

    try {
      const parseResult = OAuthClientMetadataSchema.safeParse(await c.req.json());
      if (!parseResult.success) {
        throw new InvalidClientMetadataError(parseResult.error.message);
      }

      const clientMetadata = parseResult.data;
      const isPublicClient = clientMetadata.token_endpoint_auth_method === 'none'

      // Generate client credentials
      const clientSecret = isPublicClient
        ? undefined
        : crypto.randomBytes(32).toString('hex');
      const clientIdIssuedAt = Math.floor(Date.now() / 1000);

      // Calculate client secret expiry time
      const clientsDoExpire = clientSecretExpirySeconds > 0
      const secretExpiryTime = clientsDoExpire ? clientIdIssuedAt + clientSecretExpirySeconds : 0
      const clientSecretExpiresAt = isPublicClient ? undefined : secretExpiryTime

      let clientInfo: Omit<OAuthClientInformationFull, "client_id"> & { client_id?: string } = {
        ...clientMetadata,
        client_secret: clientSecret,
        client_secret_expires_at: clientSecretExpiresAt,
      };

      if (clientIdGeneration) {
        clientInfo.client_id = crypto.randomUUID();
        clientInfo.client_id_issued_at = clientIdIssuedAt;
      }

      clientInfo = await clientsStore.registerClient!(clientInfo);
      return c.json(clientInfo, 201);
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