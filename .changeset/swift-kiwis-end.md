---
'@hono/zod-openapi': patch
---

Reduce route-typing type instantiations (~60% on TS6, ~53% on TS7-rc) by binding expensive sub-expressions once and sharing the input intersection / response-shape conditional.
