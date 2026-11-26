# @hono/casbin

## 1.0.1

### Patch Changes

- [#2281](https://github.com/honojs/middleware/pull/2281) [`d72543d`](https://github.com/honojs/middleware/commit/d72543da07fdb95d8f9f4a5d7ee3087f68a4348a) Thanks [@hono-kun](https://github.com/apps/hono-kun)! - fix(casbin): `jwtAuthorizer` uses only the payload that the JWT middleware of `hono/jwt` has verified. It no longer decodes the `Authorization` header by itself, so it denies the request when `jwt()` is not used before `casbin()`.

## 1.0.0

### Major Changes

- [#676](https://github.com/honojs/middleware/pull/676) [`b7e740f9305a7157e9e195e89d37df3ea87c8ce9`](https://github.com/honojs/middleware/commit/b7e740f9305a7157e9e195e89d37df3ea87c8ce9) Thanks [@sugar-cat7](https://github.com/sugar-cat7)! - Initial release
