---
'@hono/zod-validator': patch
---

fix(zod-validator): surface the default `400` failure response so it propagates to the RPC schema (refs honojs/hono#3746).

- Widen the no-hook overload return type to `MiddlewareHandler<E, P, V, TypedResponse<ZodValidatorFailureBody<T>, 400, 'json'>>`, so the default `c.json(result, 400)` body reaches `MergeMiddlewareResponse<M_k>` on the Hono side and shows up in `hc<typeof app>` as a typed `400` branch.
- Intersect the inferred middleware response with `Response` (`Response & TypedResponse<...>`) in both `ZodValidatorFailureResponse<T>` and `ExtractValidationResponse<VF>` so a `zValidator(...)` middleware remains assignable to a plain `MiddlewareHandler` (avoids a `TS2322` regression caused by bare `TypedResponse`).
- Collapse the no-hook overload to also accept `undefined` for the hook parameter together with the `options.validationFunction`, allowing `zValidator(target, schema, undefined, { validationFunction })` to match the typed-failure path.
- Bump `peerDependencies.hono` to `>=4.10.0` because this PR now relies on the 4-argument `MiddlewareHandler<E, P, I, R>` signature introduced in Hono v4.10.0; on `hono` <4.10.0, `MiddlewareHandler` only accepts 3 type arguments and consumers would hit `TS2707` even though peer ranges currently allow it.
