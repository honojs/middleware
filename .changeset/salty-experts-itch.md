---
'@hono/structured-logger': major
---

Redesign the public API.

**Breaking changes:**

- Removed `BaseLogger` export. The middleware no longer constrains the logger type — pass any logger via `createLogger` and TypeScript infers `L` from its return type.
- Removed default `onRequest`, `onResponse`, and `onError` implementations. `onResponse` is now required; `onRequest` and `onError` are optional.
- Hook signatures are now inferred from `StructuredLoggerOptions`.
- The `L` type parameter now defaults to `unknown` instead of `BaseLogger`.

**New features:**

- Added `skip` option: `(c: Context) => boolean`. When it returns `true`, hooks are suppressed but the logger is still created and available on `c.var`.

**Behaviour change:**

- `elapsedMs` now measures handler duration only. The timer starts after `onRequest` returns, so `onRequest` processing time is excluded.
