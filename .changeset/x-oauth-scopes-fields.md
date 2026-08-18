---
"@hono/oauth-providers": patch
---

Update X (Twitter) OAuth types to match the current API: add the `users.email`, `dm.read`, `dm.write` and `media.write` scopes, and the newer `user.fields` (e.g. `confirmed_email`, `is_identity_verified`, `subscription`, `verified_followers_count`, `affiliation`). The corresponding properties are also added to the `XUser` response type. These were previously missing, so requesting them required casting around the types.
