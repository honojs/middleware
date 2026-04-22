# @hono/markdown-for-agents

Hono middleware for [markdown-for-agents](https://www.npmjs.com/package/markdown-for-agents) — converts HTML responses to clean, token-efficient Markdown for AI agents.

> `markdown-for-agents` is an ESM-only dependency.

When a client sends `Accept: text/markdown`, HTML responses are automatically converted to Markdown — typically saving 80–90% of tokens. Normal browser requests pass through untouched.

## Install

```bash
npm install @hono/markdown-for-agents
# yarn add @hono/markdown-for-agents
```

## Usage

```ts
import { Hono } from 'hono'
import { markdown } from '@hono/markdown-for-agents'

const app = new Hono()
app.use(markdown())

app.get('/', (c) => {
  return c.html('<h1>Hello</h1>')
})

export default app
```

```bash
# Normal HTML response
curl http://localhost:3000

# Markdown response for AI agents
curl -H "Accept: text/markdown" http://localhost:3000
```

## How it works

The middleware uses content negotiation. When a client sends `Accept: text/markdown`, HTML responses are automatically converted to Markdown. The response includes:

- `Content-Type: text/markdown; charset=utf-8`
- `x-markdown-tokens` header with the token count
- `ETag` header with a content hash for cache validation
- `Vary: Accept` header so CDNs cache HTML and Markdown separately
- `content-signal` header with publisher consent signals (when configured)

## Options

Accepts all [`markdown-for-agents` options](https://www.npmjs.com/package/markdown-for-agents#options):

```ts
app.use(
  markdown({
    // Strip nav, ads, sidebars, cookie banners
    extract: true,

    // Resolve relative URLs
    baseUrl: 'https://example.com',

    // Remove duplicate content blocks
    deduplicate: true,

    // Custom token counter (e.g. tiktoken)
    tokenCounter: (text) => ({
      tokens: enc.encode(text).length,
      characters: text.length,
      words: text.split(/\s+/).filter(Boolean).length,
    }),

    // Publisher consent signal header
    contentSignal: { aiTrain: true, search: true, aiInput: true },
  })
)
```

## Author

Konstantin Konstantinov <https://github.com/KKonstantinov>

## License

MIT
