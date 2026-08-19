---
'@hono/zod-openapi': patch
---

Reduce route-typing type instantiations (~54% on TS6, ~48% on TS7 in a 100-route benchmark) by binding expensive sub-expressions once and sharing the input intersection / response-shape conditional.
