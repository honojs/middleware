# AI Robots blocker middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=ai-robots-txt)](https://codecov.io/github/honojs/middleware)

The AI robots blocker middleware for [Hono](https://honojs.dev) applications.
You can block AI bots and crawlers based on their User-Agent headers and generate robots.txt files to discourage them.

## Usage

### Block AI Bots Middleware

Block all known AI bots and crawlers:

```ts
import { blockAiBots } from '@hono/ai-robots-txt'
import { Hono } from 'hono'

const app = new Hono()

// Block all AI bots
app.use('*', blockAiBots())
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Block only non-respecting bots

Allow bots that respect robots.txt and only block known non-respecting ones:

```ts
import { blockAiBots } from '@hono/ai-robots-txt'
import { Hono } from 'hono'

const app = new Hono()

// Allow bots that respect robots.txt
app.use('*', blockAiBots({ allowRespecting: true }))
// Serve the robots.txt file with AI bots rules
app.use('/robots.txt', useAiRobotsTxt())
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Serve AI Robots.txt

Generate and serve a robots.txt file that blocks all known AI bots:

```ts
import { useAiRobotsTxt } from '@hono/ai-robots-txt'
import { Hono } from 'hono'

const app = new Hono()

// Serve robots.txt at /robots.txt
app.use('/robots.txt', useAiRobotsTxt())
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Generate robots.txt content

Generate robots.txt content programmatically.

This allows you to complete it

```ts
import { aiRobotsTxt } from '@hono/ai-robots-txt'

const robotsContent = aiRobotsTxt()
console.log(robotsContent)
// Output:
// User-agent: GPTBot
// User-agent: ChatGPT-User
// User-agent: Bytespider
// User-agent: CCBot
// ...
// Disallow: /

const app = new Hono()

app.use('/robots.txt', (c) => {
    robotsTxt = robotsContent + "\nUser-agent: GoogleBot\nAllow: /"
    return c.text(robotsTxt, 200)
})
```

## API

### `blockAiBots(options?)`

Middleware that blocks AI bots based on their User-Agent header.

**Parameters:**
- `options.allowRespecting` (boolean, default: `false`) - If `true`, only blocks bots that are known to not respect robots.txt. If `false`, blocks all known AI bots.

**Returns:** Hono middleware function

### `aiRobotsTxt()`

Generates robots.txt content that blocks all known AI bots.

**Returns:** String containing robots.txt content

### `useAiRobotsTxt()`

Middleware that serves the generated robots.txt content.

**Returns:** Hono middleware function

## Author

finxol <https://github.com/finxol>

## License

MIT
