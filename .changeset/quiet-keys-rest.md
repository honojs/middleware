---
'@hono/cloudflare-access': patch
---

fix(cloudflare-access): reject tokens whose `kid` matches an `Object.prototype` property with 401 instead of an unhandled error
