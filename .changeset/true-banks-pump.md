---
'@hono/zod-openapi': patch
---

Fix critical security vulnerability in body validation

Fixes a security issue where request body validation could be bypassed by omitting the Content-Type header (introduced in v0.15.2).

Security Impact:
- Previously, requests without Content-Type headers would skip validation entirely, allowing unvalidated data to reach handlers
- This could lead to type safety violations, unexpected behavior, and potential security vulnerabilities

Changes:
- Made validation strict by default (when required is not specified)
- Requests without Content-Type are now validated instead of bypassing validation
- Added proper handling for multiple content-type scenarios
- Return 400 errors for unsupported content-types

Breaking Change:
To allow optional body validation (previous behavior), explicitly set required: false in the route configuration.