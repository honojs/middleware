---
'@hono/standard-validator': patch
---

fix(standard-validator): preserve literal union types in RPC input and fix hook data type

- Port `InferInput` utility from `@hono/zod-validator` to preserve literal union types (e.g., `z.enum(["asc", "desc"])`) in the RPC client's input type, while still falling back to wire-level types (`string | string[]` for query, `string` for param/header/cookie) for non-literal values.
- Fix hook `data` type to use `InferInput` instead of `InferOutput`, matching the runtime behavior where the raw input value is passed to the hook (fixes #1990).
