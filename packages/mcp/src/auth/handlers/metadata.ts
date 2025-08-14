import type { OAuthMetadata, OAuthProtectedResourceMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Hono } from "hono";
import { cors } from "hono/cors";

export function metadataHandler(metadata: OAuthMetadata | OAuthProtectedResourceMetadata): Hono {
  // Nested router so we can configure middleware and restrict HTTP method
  const router = new Hono();

  // Configure CORS to allow any origin, to make accessible to web-based MCP clients
  router.use(cors());

  router.get("/", (c) =>
    c.json(metadata)
  );

  return router;
}
