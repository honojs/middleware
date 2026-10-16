---
'@hono/trpc-server': minor
---

Add `trpcFetchHandler`, a wrapper around `@trpc/server`'s `fetchRequestHandler` that preserves router context inference. `createContext` is required when the router has a typed context and optional otherwise, matching `fetchRequestHandler`'s own contract. `trpcServer` is unchanged.
