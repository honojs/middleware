---
'@hono/eslint-config': patch
---

Make `@typescript-eslint/no-base-to-string` less strict,
allowing `toString()` to be used with `["Error","RegExp","URL","URLSearchParams"]`
