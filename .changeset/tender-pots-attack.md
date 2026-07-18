---
'@hono/zod-openapi': patch
---

Accept schemas from any library implementing [Standard JSON Schema](https://standardschema.dev/json-schema), such as ArkType, alongside Zod. A route can mix libraries: non-Zod schemas are validated through their Standard Schema interface and documented with the JSON Schema they generate, while Zod schemas keep going through `@asteasolutions/zod-to-openapi` untouched. Configure which JSON Schema dialect to request via `jsonSchemaTargets` when a library only supports specific targets.
