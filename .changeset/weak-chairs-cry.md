---
'@hono/clerk-auth': major
---

Move `@clerk/backend` from peerDependencies to dependencies and bump to `2.x.x`.

This change ensures the package is directly available without requiring consumers to install it separately. The version bump includes the upcoming machine authentication feature while maintaining backward compatibility.
