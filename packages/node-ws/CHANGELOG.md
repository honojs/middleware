# @hono/node-ws

## 1.1.1

### Patch Changes

- [#1094](https://github.com/honojs/middleware/pull/1094) [`519404ad2c343bcc7043d77dc6ce82217871f209`](https://github.com/honojs/middleware/commit/519404ad2c343bcc7043d77dc6ce82217871f209) Thanks [@nakasyou](https://github.com/nakasyou)! - Adapter won't send Buffer as a MessageEvent.

## 1.1.0

### Minor Changes

- [#973](https://github.com/honojs/middleware/pull/973) [`6f90a574c465b4d0ecadbe605bdf434b9f3c95f3`](https://github.com/honojs/middleware/commit/6f90a574c465b4d0ecadbe605bdf434b9f3c95f3) Thanks [@dkulyk](https://github.com/dkulyk)! - Added rejection of WebSocket connections when the app does not expect them

## 1.0.8

### Patch Changes

- [#959](https://github.com/honojs/middleware/pull/959) [`c24efa6b8af08d0d0b3315b7b5b7355b5dd7ff5a`](https://github.com/honojs/middleware/commit/c24efa6b8af08d0d0b3315b7b5b7355b5dd7ff5a) Thanks [@nakasyou](https://github.com/nakasyou)! - fix a bug of upgrading

## 1.0.7

### Patch Changes

- [#951](https://github.com/honojs/middleware/pull/951) [`c80ffbfb4c72e8ad7e9a7f65611aa667c6776d64`](https://github.com/honojs/middleware/commit/c80ffbfb4c72e8ad7e9a7f65611aa667c6776d64) Thanks [@yusukebe](https://github.com/yusukebe)! - fix: allow `Hono` with custom Env for `createNodeWebSocket`

## 1.0.6

### Patch Changes

- [#940](https://github.com/honojs/middleware/pull/940) [`3e2db6dc33c7ab7f471bed65004ebf8139ba7695`](https://github.com/honojs/middleware/commit/3e2db6dc33c7ab7f471bed65004ebf8139ba7695) Thanks [@Ryiski](https://github.com/Ryiski)! - fix: Added missing WSContext raw type

## 1.0.5

### Patch Changes

- [#876](https://github.com/honojs/middleware/pull/876) [`a092ffaadb3a265a207acc558e6cd021fc3bb6d9`](https://github.com/honojs/middleware/commit/a092ffaadb3a265a207acc558e6cd021fc3bb6d9) Thanks [@HusamElbashir](https://github.com/HusamElbashir)! - Fixed case-sensitivity of the WebSocket "Upgrade" header value

## 1.0.4

### Patch Changes

- [#648](https://github.com/honojs/middleware/pull/648) [`139e34a90775d25a61002baeb84d7927b9d75b70`](https://github.com/honojs/middleware/commit/139e34a90775d25a61002baeb84d7927b9d75b70) Thanks [@Yovach](https://github.com/Yovach)! - Add a `CloseEvent` class to avoid exception "CloseEvent is not defined"

## 1.0.3

### Patch Changes

- [#639](https://github.com/honojs/middleware/pull/639) [`2f307e687797feaf68de4579cf14c230f239fa2b`](https://github.com/honojs/middleware/commit/2f307e687797feaf68de4579cf14c230f239fa2b) Thanks [@Yovach](https://github.com/Yovach)! - Fixed wrong byteLength on binary messages

## 1.0.2

### Patch Changes

- [#605](https://github.com/honojs/middleware/pull/605) [`967fd48d5b2b1dc0291e8df49dffd79cbdf09c0c`](https://github.com/honojs/middleware/commit/967fd48d5b2b1dc0291e8df49dffd79cbdf09c0c) Thanks [@inaridiy](https://github.com/inaridiy)! - Fixed bug with multiple connections in node-ws

## 1.0.1

### Patch Changes

- [#539](https://github.com/honojs/middleware/pull/539) [`ec6ec4ec02f8db46e3151e7334535e562dfc47e3`](https://github.com/honojs/middleware/commit/ec6ec4ec02f8db46e3151e7334535e562dfc47e3) Thanks [@mikestopcontinues](https://github.com/mikestopcontinues)! - create only one WebSocketServer instead of per websocket request

## 1.0.0

### Major Changes

- [#503](https://github.com/honojs/middleware/pull/503) [`d11c3a565f47f26b6882cef416d86f3f7d9c214c`](https://github.com/honojs/middleware/commit/d11c3a565f47f26b6882cef416d86f3f7d9c214c) Thanks [@nakasyou](https://github.com/nakasyou)! - Inited @hono/node-ws
