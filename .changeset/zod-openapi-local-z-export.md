---
"@hono/zod-openapi": patch
---

fix(zod-openapi): keep the `z` import edge so `.openapi()` survives bundling

Re-exporting zod's `z` as a pass-through let esbuild code-splitting resolve
`import { z } from '@hono/zod-openapi'` straight to zod and drop the edge to the
module that runs `extendZodWithOpenApi(z)`, so schemas could be built before the
patch applied and `.openapi()` was undefined at runtime. Export `z` as an alias
declaration instead: it compiles to a binding local to the module, which keeps
that edge, while still carrying zod's type namespace so `z.infer`, `z.ZodType`
and the rest continue to work. Fixes #2051.
