import { InvalidRequestError, OAuthError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthTokenRevocationRequestSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { MiddlewareHandler } from "hono";
import type { ClientAuthenticationEnv } from "../middleware/clientAuth";

export function revokeHandler(provider: OAuthServerProvider): MiddlewareHandler<ClientAuthenticationEnv> {
  return async (c) => {
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
  }
}