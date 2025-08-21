---
'@hono/oauth-providers': patch
---

fix: enable CSRF protection for MSEntra ID authentication

Fixed a bug where the state parameter was not being passed to the MSEntra AuthFlow constructor. As a result, CSRF protection now properly works for MSEntra ID authentication, ensuring that authentication requests are protected against Cross-Site Request Forgery attacks.
