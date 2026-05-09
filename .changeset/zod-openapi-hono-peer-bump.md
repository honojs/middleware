---
'@hono/zod-openapi': minor
---

fix(zod-openapi): bump `peerDependencies.hono` to `>=4.10.0` to match the runtime requirement coming through `@hono/zod-validator`.

`@hono/zod-openapi` lists `@hono/zod-validator` as a direct (non-peer) dependency, so its peer range must be at least as strict as `@hono/zod-validator`'s. After the typed-400 fix bumps `@hono/zod-validator`'s `peerDependencies.hono` to `>=4.10.0`, leaving `@hono/zod-openapi`'s peer at `>=4.3.6` would let consumers install `@hono/zod-openapi` against e.g. `hono@4.9.9`, where the bundled `@hono/zod-validator` types reference the 4-argument `MiddlewareHandler<E, P, I, R>` (introduced in Hono v4.10.0) and fail to compile (`TS2707`).
