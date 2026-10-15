---
'@hono/inertia': patch
---

Escape less-than signs in serialized page JSON so props containing `<!--<script>` cannot swallow the rest of the HTML document.
