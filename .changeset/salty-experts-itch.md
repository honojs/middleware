---
'@hono/structured-logger': major
---

Redesign the public API.

**Breaking changes:**

- Removed `BaseLogger` export. The middleware no longer constrains the logger type — pass any logger via `createLogger` and TypeScript infers `L` from its return type.
- Removed default `onRequest`, `onResponse`, and `onError` implementations. Hooks must now be provided explicitly; requests with no hooks configured pass through without any logging side effects.
- Hook signatures are now inferred from `StructuredLoggerOptions`.
- The `L` type parameter now defaults to `unknown` instead of `BaseLogger`.

**New features:**

- Added `skip` option: `(c: Context) => boolean`. When it returns `true`, the request bypasses `createLogger` and all hooks entirely.

**Behaviour change:**

- `elapsedMs` now measures handler duration only. The timer starts after `onRequest` returns, so `onRequest` processing time is excluded.
