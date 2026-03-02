---
'@hono/eslint-config': minor
---

Update [`@typescript-eslint/no-unused-vars`](https://typescript-eslint.io/rules/no-unused-vars/) to match
the behaviour of [`noUnusedLocals`](https://www.typescriptlang.org/tsconfig/#noUnusedLocals) and [`noUnusedParameters`](https://www.typescriptlang.org/tsconfig/#noUnusedParameters).
Specifcally ignoring variables and parameters prefixed with `_`