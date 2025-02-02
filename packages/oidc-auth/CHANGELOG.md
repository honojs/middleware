# @hono/oidc-auth

## 1.4.1

### Patch Changes

- [#936](https://github.com/honojs/middleware/pull/936) [`be34f6908f1ecc22171d302edb10036b3bba9fe9`](https://github.com/honojs/middleware/commit/be34f6908f1ecc22171d302edb10036b3bba9fe9) Thanks [@hnw](https://github.com/hnw)! - Fix type error

## 1.4.0

### Minor Changes

- [#926](https://github.com/honojs/middleware/pull/926) [`2f716d619d9e61df3f12427ef6cdebaf0888569e`](https://github.com/honojs/middleware/commit/2f716d619d9e61df3f12427ef6cdebaf0888569e) Thanks [@hnw](https://github.com/hnw)! - Add support for absolute path in OIDC_REDIRECT_URI and set its default value to '/callback'

## 1.3.0

### Minor Changes

- [#919](https://github.com/honojs/middleware/pull/919) [`4a0606f774022097bf7de69077fe366280bf4f49`](https://github.com/honojs/middleware/commit/4a0606f774022097bf7de69077fe366280bf4f49) Thanks [@maemaemae3](https://github.com/maemaemae3)! - Optionally specify a custom cookie domain using the OIDC_COOKIE_DOMAIN environment variable (default is domain of the request)

## 1.2.0

### Minor Changes

- [#789](https://github.com/honojs/middleware/pull/789) [`68eec9e2bc9aedbf3d631a2c6a4c7f55417d661c`](https://github.com/honojs/middleware/commit/68eec9e2bc9aedbf3d631a2c6a4c7f55417d661c) Thanks [@maemaemae3](https://github.com/maemaemae3)! - Optionally specify a custom cookie name using the OIDC_COOKIE_NAME environment variable (default is 'oidc-auth')

## 1.1.0

### Minor Changes

- [#711](https://github.com/honojs/middleware/pull/711) [`5675a5fc323a007447f077b97273938baddba59c`](https://github.com/honojs/middleware/commit/5675a5fc323a007447f077b97273938baddba59c) Thanks [@ameinhardt](https://github.com/ameinhardt)! - define custom scope, access oauth response and set custom session claims

- [#709](https://github.com/honojs/middleware/pull/709) [`cd99b40177cc3eef706ab37d21f4351e86934cc6`](https://github.com/honojs/middleware/commit/cd99b40177cc3eef706ab37d21f4351e86934cc6) Thanks [@ameinhardt](https://github.com/ameinhardt)! - Optionally restrict cookie path with new envvar OIDC_COOKIE_PATH

- [#709](https://github.com/honojs/middleware/pull/709) [`cd99b40177cc3eef706ab37d21f4351e86934cc6`](https://github.com/honojs/middleware/commit/cd99b40177cc3eef706ab37d21f4351e86934cc6) Thanks [@ameinhardt](https://github.com/ameinhardt)! - Restrict path of callback cookies to pathname of OIDC_REDIRECT_URI

## 1.0.1

### Patch Changes

- [#386](https://github.com/honojs/middleware/pull/386) [`fda62dea375e736b9d5c6ad902a7b24f6de47560`](https://github.com/honojs/middleware/commit/fda62dea375e736b9d5c6ad902a7b24f6de47560) Thanks [@hnw](https://github.com/hnw)! - Fix "yarn release" and fix npm package

## 1.0.0

### Major Changes

- [#372](https://github.com/honojs/middleware/pull/372) [`7777562f64d517d0764bc4732fde7edbff4ff537`](https://github.com/honojs/middleware/commit/7777562f64d517d0764bc4732fde7edbff4ff537) Thanks [@hnw](https://github.com/hnw)! - Releasing first version
