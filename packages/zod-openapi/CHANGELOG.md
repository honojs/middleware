# @hono/zod-openapi

## 0.9.1

### Patch Changes

- [#287](https://github.com/honojs/middleware/pull/287) [`1568b92`](https://github.com/honojs/middleware/commit/1568b920de1e45b963d1812c32932fad01dbe2fe) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: Strict type checking of return values

## 0.9.0

### Minor Changes

- [#272](https://github.com/honojs/middleware/pull/272) [`d4aa8ec`](https://github.com/honojs/middleware/commit/d4aa8ec5ad38942c1606642dc4676a92a7c006a8) Thanks [@Karibash](https://github.com/Karibash)! - Make context accessible in the doc route

## 0.8.6

### Patch Changes

- [#260](https://github.com/honojs/middleware/pull/260) [`ba83a26`](https://github.com/honojs/middleware/commit/ba83a268e010a7b18172e7de01e3901b58a7ec62) Thanks [@Karibash](https://github.com/Karibash)! - Make it possible to do method chaining even for doc methods

## 0.8.5

### Patch Changes

- [#258](https://github.com/honojs/middleware/pull/258) [`368c352`](https://github.com/honojs/middleware/commit/368c3520fa8a15657e8e42313bbfde3d87b0183b) Thanks [@Karibash](https://github.com/Karibash)! - Fix a bug that slashes were duplicated when mounting a path using the route method

## 0.8.4

### Patch Changes

- [#255](https://github.com/honojs/middleware/pull/255) [`129f468`](https://github.com/honojs/middleware/commit/129f4680a2c050ec49a0422d735e0d173d7b5faf) Thanks [@Karibash](https://github.com/Karibash)! - Fix incorrect specification of the exports field in package.json

## 0.8.3

### Patch Changes

- [#222](https://github.com/honojs/middleware/pull/222) [`73ab82a`](https://github.com/honojs/middleware/commit/73ab82a90253a0dbc536251787ff5713981a4075) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: import types correctly

## 0.8.2

### Patch Changes

- [#217](https://github.com/honojs/middleware/pull/217) [`a80c84b`](https://github.com/honojs/middleware/commit/a80c84ba07153f8521c1fc0286abef0623c99b5c) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: bump Hono for `peerDependencies`

## 0.8.1

### Patch Changes

- [#211](https://github.com/honojs/middleware/pull/211) [`6ca8e8d`](https://github.com/honojs/middleware/commit/6ca8e8d8de85dde7b9c25bfd5665aa32e233402e) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: relax input types

## 0.8.0

### Minor Changes

- [#206](https://github.com/honojs/middleware/pull/206) [`2d2fdd0`](https://github.com/honojs/middleware/commit/2d2fdd0379a31320b06f6d1a9e4634bfe1b7c657) Thanks [@yusukebe](https://github.com/yusukebe)! - feat: allows the response to be `Response` not just `TypedResponse`.

## 0.7.2

### Patch Changes

- [#189](https://github.com/honojs/middleware/pull/189) [`58167f3`](https://github.com/honojs/middleware/commit/58167f3b7f3c564334f5182529f0ddb29ace0af1) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: publish as cjs by default

## 0.7.1

### Patch Changes

- [#182](https://github.com/honojs/middleware/pull/182) [`9aefddc`](https://github.com/honojs/middleware/commit/9aefddc45d048e5e51eb36d81cb878c62a72ba9f) Thanks [@ZerNico](https://github.com/ZerNico)! - properly convert openapi path type to hono

## 0.7.0

### Minor Changes

- [#170](https://github.com/honojs/middleware/pull/170) [`9c45dbc`](https://github.com/honojs/middleware/commit/9c45dbc41d46ae4d04d9351757020d7ad528b400) Thanks [@msutkowski](https://github.com/msutkowski)! - Add defaultHook as an option for OpenAPIHono

### Patch Changes

- [#179](https://github.com/honojs/middleware/pull/179) [`047eca5`](https://github.com/honojs/middleware/commit/047eca5ca99085ee8c4f1581b17c8ebeae6afc82) Thanks [@yusukebe](https://github.com/yusukebe)! - fix(zod-openapi): enable `basePath()`

- [#176](https://github.com/honojs/middleware/pull/176) [`fb63ef4`](https://github.com/honojs/middleware/commit/fb63ef413cb7b843aebe756a5322bdd10ba74500) Thanks [@yusukebe](https://github.com/yusukebe)! - fix(zod-openapi): make multiple routes types correct for `hc`

- Updated dependencies [[`a9123dd`](https://github.com/honojs/middleware/commit/a9123dd9e3e90d4d73f495d6b407ebacf9ea0ad8)]:
  - @hono/zod-validator@0.1.9

## 0.6.0

### Minor Changes

- [#167](https://github.com/honojs/middleware/pull/167) [`dbebf74`](https://github.com/honojs/middleware/commit/dbebf747c9c7ca94bf22259772d8b1e0623ce68d) Thanks [@exsjabe](https://github.com/exsjabe)! - Export types that allow for separate declaratins of route handlers and hooks

## 0.5.1

### Patch Changes

- [#164](https://github.com/honojs/middleware/pull/164) [`62a97fd`](https://github.com/honojs/middleware/commit/62a97fda6a784f11549fff442978677642d2b218) Thanks [@yusukebe](https://github.com/yusukebe)! - fix(zod-openapi): use `z.output` for types after validation

## 0.5.0

### Minor Changes

- [#161](https://github.com/honojs/middleware/pull/161) [`05b8e9a`](https://github.com/honojs/middleware/commit/05b8e9a7511874f7e9dcb84b9dcfa97ca458ae4e) Thanks [@naporin0624](https://github.com/naporin0624)! - Add getRoutingPath to the return value of createRoute.

## 0.4.0

### Minor Changes

- [#153](https://github.com/honojs/middleware/pull/153) [`430088e`](https://github.com/honojs/middleware/commit/430088e17569a12e354c80c1d6da67a9ecbfdffe) Thanks [@mikestopcontinues](https://github.com/mikestopcontinues)! - Merge subapps' spec definitions into main app

- [#153](https://github.com/honojs/middleware/pull/153) [`430088e`](https://github.com/honojs/middleware/commit/430088e17569a12e354c80c1d6da67a9ecbfdffe) Thanks [@mikestopcontinues](https://github.com/mikestopcontinues)! - Support v3.1 spec output

- [#153](https://github.com/honojs/middleware/pull/153) [`430088e`](https://github.com/honojs/middleware/commit/430088e17569a12e354c80c1d6da67a9ecbfdffe) Thanks [@mikestopcontinues](https://github.com/mikestopcontinues)! - OpenAPIHono constructor supports init object

## 0.3.1

### Patch Changes

- [#155](https://github.com/honojs/middleware/pull/155) [`804caac`](https://github.com/honojs/middleware/commit/804caac19123e0b6d9a3f33b686051f1f111ee1f) Thanks [@yusukebe](https://github.com/yusukebe)! - fix(zod-openapi): support multiple params

## 0.3.0

### Minor Changes

- [#150](https://github.com/honojs/middleware/pull/150) [`1006cbc`](https://github.com/honojs/middleware/commit/1006cbca6b6636340afe10f7680511bab2046b47) Thanks [@yusukebe](https://github.com/yusukebe)! - feat(zod-openapi): make `app.openAPIRegistry` public

### Patch Changes

- [#148](https://github.com/honojs/middleware/pull/148) [`1bfd648`](https://github.com/honojs/middleware/commit/1bfd648df8dfcd659c14514b977de945d3806b7d) Thanks [@yusukebe](https://github.com/yusukebe)! - fix(zod-openapi): fix a type error

## 0.2.0

### Minor Changes

- [#141](https://github.com/honojs/middleware/pull/141) [`f334e99`](https://github.com/honojs/middleware/commit/f334e99251cdabc8be9334eec7eb7d9a450d8e35) Thanks [@yusukebe](https://github.com/yusukebe)! - feat: support `headers` and `cookies`

## 0.1.2

### Patch Changes

- [#139](https://github.com/honojs/middleware/pull/139) [`991b859`](https://github.com/honojs/middleware/commit/991b85915a63d1fd15cda52078f6401c17d3879f) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: bump up Hono version

## 0.1.1

### Patch Changes

- [#132](https://github.com/honojs/middleware/pull/132) [`2dbc823`](https://github.com/honojs/middleware/commit/2dbc823b29a95e6c81bedc5416c08f15ac97288d) Thanks [@yusukebe](https://github.com/yusukebe)! - fix path param format `:id` to `{id}`

## 0.1.0

### Minor Changes

- [#124](https://github.com/honojs/middleware/pull/124) [`e6b20c6`](https://github.com/honojs/middleware/commit/e6b20c64b61654dc742b233ad09d764c71db7186) Thanks [@yusukebe](https://github.com/yusukebe)! - feat(zod-openapi): support RPC-mode

## 0.0.1

### Patch Changes

- [#121](https://github.com/honojs/middleware/pull/121) [`1233c00`](https://github.com/honojs/middleware/commit/1233c00875827749599880ade5830f8a1e7d73e8) Thanks [@yusukebe](https://github.com/yusukebe)! - docs: fixed readme

- [#118](https://github.com/honojs/middleware/pull/118) [`7b89803`](https://github.com/honojs/middleware/commit/7b898034a50c9bfa08872e28dcaa066ea55d9e3d) Thanks [@yusukebe](https://github.com/yusukebe)! - introduce Zod OpenAPI
