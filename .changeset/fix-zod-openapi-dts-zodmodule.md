---
'@hono/zod-openapi': patch
---

Fixed published `.d.cts` / `.d.mts` files referencing `zodModule` without importing it. The declaration bundler now preserves the `import * as zodModule from "zod"` that backs `export import z = zodModule.z`, so `z.infer` and the rest of the zod type namespace resolve again for consumers.
