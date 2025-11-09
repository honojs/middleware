# @hono/otel

## 1.0.1

### Patch Changes

- [#1536](https://github.com/honojs/middleware/pull/1536) [`aa23285ff3422080ebbde3e4a90d859ae93a336d`](https://github.com/honojs/middleware/commit/aa23285ff3422080ebbde3e4a90d859ae93a336d) Thanks [@amaany3](https://github.com/amaany3)! - fix(otel): Include serviceName and serviceVersion in span attributes

## 1.0.0

### Major Changes

- [#1513](https://github.com/honojs/middleware/pull/1513) [`0e15cbe0e4a6700a3131a7384ff3ea7f86bffd8f`](https://github.com/honojs/middleware/commit/0e15cbe0e4a6700a3131a7384ff3ea7f86bffd8f) Thanks [@mrlorentx](https://github.com/mrlorentx)! - Aligns otel middleware with conventions of opentelemetry

## 0.6.0

### Minor Changes

- [#1509](https://github.com/honojs/middleware/pull/1509) [`0df42355b8a66f28014d187846263c0e24cb990e`](https://github.com/honojs/middleware/commit/0df42355b8a66f28014d187846263c0e24cb990e) Thanks [@sugar-cat7](https://github.com/sugar-cat7)! - Support for required attributes based on OpenTelemetry HTTP Server Span specification

## 0.5.0

### Minor Changes

- [#1393](https://github.com/honojs/middleware/pull/1393) [`3eee8ae1dbc8870ca56695ec18c147ef82525049`](https://github.com/honojs/middleware/commit/3eee8ae1dbc8870ca56695ec18c147ef82525049) Thanks [@cs-balazs](https://github.com/cs-balazs)! - Support custom time input for span startTime & endTime

## 0.4.0

### Minor Changes

- [#1365](https://github.com/honojs/middleware/pull/1365) [`3864bdb4b0277967951ca983cd429f54929f3e52`](https://github.com/honojs/middleware/commit/3864bdb4b0277967951ca983cd429f54929f3e52) Thanks [@zwpaper](https://github.com/zwpaper)! - Support otel metrics instrument

## 0.3.0

### Minor Changes

- [#1328](https://github.com/honojs/middleware/pull/1328) [`5416ee700cbc57d686b1174b08da8c541b0a70ba`](https://github.com/honojs/middleware/commit/5416ee700cbc57d686b1174b08da8c541b0a70ba) Thanks [@tsuyuni](https://github.com/tsuyuni)! - Add `captureRequestHeaders` and `captureResponseHeaders` options for selective header collection.

## 0.2.2

### Patch Changes

- [#1203](https://github.com/honojs/middleware/pull/1203) [`3c1ecb0ce9ad6a3d3e1290a71e4a636a1d4acf29`](https://github.com/honojs/middleware/commit/3c1ecb0ce9ad6a3d3e1290a71e4a636a1d4acf29) Thanks [@BarryThePenguin](https://github.com/BarryThePenguin)! - Add explicit `MiddlewareHandler` return type

## 0.2.1

### Patch Changes

- [#1191](https://github.com/honojs/middleware/pull/1191) [`a70d91950f8c66201711ffc5d8505979f0403332`](https://github.com/honojs/middleware/commit/a70d91950f8c66201711ffc5d8505979f0403332) Thanks [@Kazy](https://github.com/Kazy)! - Record uncaught exceptions as events attached to the request span

## 0.2.0

### Minor Changes

- [#1151](https://github.com/honojs/middleware/pull/1151) [`414f0a6c9502de4135d50a4f80698a8d2f09a81d`](https://github.com/honojs/middleware/commit/414f0a6c9502de4135d50a4f80698a8d2f09a81d) Thanks [@nrdobie](https://github.com/nrdobie)! - Added support for W3C Trace Context format

## 0.1.1

### Patch Changes

- [#1113](https://github.com/honojs/middleware/pull/1113) [`362b6701a6ee2843a51c1dfd5877a6164b7474fb`](https://github.com/honojs/middleware/commit/362b6701a6ee2843a51c1dfd5877a6164b7474fb) Thanks [@milohansen](https://github.com/milohansen)! - Use `req.routePath` to augment spans with the path that handled the request.

## 0.1.0

### Minor Changes

- [#901](https://github.com/honojs/middleware/pull/901) [`15f3dddc3eea43db8bb1da8bf456c2e79c85a4d6`](https://github.com/honojs/middleware/commit/15f3dddc3eea43db8bb1da8bf456c2e79c85a4d6) Thanks [@dahlia](https://github.com/dahlia)! - Initial OpenTelemetry support with Hono
