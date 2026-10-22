---
'@hono/ua-blocker': patch
---

Escape regex syntax characters in the `RegExp.escape` polyfill so blocklist entries such as `Bot (v1.0)` or `C++Bot` match literally on runtimes without native `RegExp.escape`, such as Node.js 22.
