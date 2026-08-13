# @hono/structured-logger

## 1.0.0

### Major Changes

- [#2070](https://github.com/honojs/middleware/pull/2070) [`b108df33b209172f6627e30cdaae4141df4a476f`](https://github.com/honojs/middleware/commit/b108df33b209172f6627e30cdaae4141df4a476f) Thanks [@BarryThePenguin](https://github.com/BarryThePenguin)! - Redesign the public API.

  **Breaking changes:**

  - Removed `BaseLogger` export. The middleware no longer constrains the logger type — pass any logger via `createLogger` and TypeScript infers `L` from its return type.
  - Removed default `onRequest`, `onResponse`, and `onError` implementations. `onResponse` is now required; `onRequest` and `onError` are optional.
  - Hook signatures are now inferred from `StructuredLoggerOptions`.
  - The `L` type parameter now defaults to `unknown` instead of `BaseLogger`.

  **New features:**

  - Added `skip` option: `(c: Context) => boolean`. When it returns `true`, hooks are suppressed but the logger is still created and available on `c.var`.

  **Behaviour change:**

  - `elapsedMs` now measures handler duration only. The timer starts after `onRequest` returns, so `onRequest` processing time is excluded.

## 0.1.0

### Minor Changes

- [#1782](https://github.com/honojs/middleware/pull/1782) [`03c135b2342b12fc8ca879a84737598eb8a72867`](https://github.com/honojs/middleware/commit/03c135b2342b12fc8ca879a84737598eb8a72867) Thanks [@gabry-ts](https://github.com/gabry-ts)! - Add @hono/structured-logger middleware: library agnostic structured logging with request scoped logger on c.var.logger, automatic response time measurement, and native requestId integration.
