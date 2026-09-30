---
'@hono/standard-json-openapi': minor
---

Initial release: OpenAPI for Hono using any library that implements [Standard JSON Schema](https://standardschema.dev/json-schema) (ArkType and Zod 4 natively, Valibot via `toStandardJsonSchema()`, Zod Mini via `z.toJSONSchema`, and others). No schema library is a dependency of this package. Configure JSON Schema dialects with `jsonSchemaTargets` when a library only supports specific targets.
