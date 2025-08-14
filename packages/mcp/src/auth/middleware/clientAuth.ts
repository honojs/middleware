import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidClientError, InvalidRequestError, OAuthError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";

export type ClientAuthenticationMiddlewareOptions = {
  /**
   * A store used to read information about registered OAuth clients.
   */
  clientsStore: OAuthRegisteredClientsStore;
}

const ClientAuthenticatedRequestSchema = z.object({
  client_id: z.string(),
  client_secret: z.string().optional(),
});

export type ClientAuthenticationEnv = {
  Variables: {
    /**
     * The authenticated client for this request, if the `authenticateClient` middleware was used.
     */
    client: OAuthClientInformationFull;
  }
}

export function authenticateClient({ clientsStore }: ClientAuthenticationMiddlewareOptions): MiddlewareHandler<ClientAuthenticationEnv> {
  return async (c, next) => {
    try {
      const result = ClientAuthenticatedRequestSchema.safeParse(await c.req.json());
      if (!result.success) {
        throw new InvalidRequestError(String(result.error));
      }

      const { client_id, client_secret } = result.data;
      const client = await clientsStore.getClient(client_id);
      if (!client) {
        throw new InvalidClientError("Invalid client_id");
      }

      // If client has a secret, validate it
      if (client.client_secret) {
        // Check if client_secret is required but not provided
        if (!client_secret) {
          throw new InvalidClientError("Client secret is required");
        }

        // Check if client_secret matches
        if (client.client_secret !== client_secret) {
          throw new InvalidClientError("Invalid client_secret");
        }

        // Check if client_secret has expired
        if (client.client_secret_expires_at && client.client_secret_expires_at < Math.floor(Date.now() / 1000)) {
          throw new InvalidClientError("Client secret has expired");
        }
      }

      c.set("client", client);

      await next();
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        return c.json(error.toResponseObject(), status);
      } else {
        const serverError = new ServerError("Internal Server Error");
        return c.json(serverError.toResponseObject(), 500);
      }
    }
  }
}