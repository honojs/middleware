---
'@hono/oauth-providers': patch
---

fix: pass missing state param to MSEntra AuthFlow

Fixed a bug where the state parameter was not being passed to the MSEntra AuthFlow constructor, which could cause CSRF protection to fail. The state parameter is now properly passed from the middleware options to the AuthFlow instance.
