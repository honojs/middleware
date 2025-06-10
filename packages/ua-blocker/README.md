# User Agent based blocker middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=ua-blocker)](https://codecov.io/github/honojs/middleware)

The UA blocker middleware for [Hono](https://honojs.dev) applications.
You can block requests based on their User-Agent headers and generate robots.txt files to discourage them.

This package also exports AI bots lists, allowing you to easily block known AI bots.

## Usage

### UA Blocker Middleware

Block requests based on a list of forbidden user-agents:

```ts
import { uaBlocker } from '@hono/ua-blocker'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', uaBlocker({
    blocklist: [], // Add your custom blocklist here
}))
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Block all known AI bots

We export a ready-to-use list of AI bots sourced from [ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt):

```ts
import { uaBlocker } from '@hono/ua-blocker'
import { aiBots } from '@hono/ua-blocker/ai-bots'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', uaBlocker({
    blocklist: aiBots,
}))
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Block only non-respecting bots

Allow bots that respect robots.txt and only block known non-respecting ones:

```ts
import { uaBlocker } from '@hono/ua-blocker'
import { nonRespectingAiBots, useAiRobotsTxt } from '@hono/ua-blocker/ai-bots'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', uaBlocker({
    blocklist: nonRespectingAiBots,
}))
// serve robots.txt
app.use('/robots.txt', useAiRobotsTxt())
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Serve ready-made AI bots Robots.txt

Serve a robots.txt file that disallows all known AI bots:

```ts
import { useAiRobotsTxt } from '@hono/ua-blocker/ai-bots'
import { Hono } from 'hono'

const app = new Hono()

// Serve robots.txt at /robots.txt
app.use('/robots.txt', useAiRobotsTxt())
app.get('/', (c) => c.text('Hello World'))

export default app
```

### Extend the robots.txt content

Import the robots.txt content directly, allowing you to complete it with other rules.

```ts
import { AI_ROBOTS_TXT } from '@hono/ua-blocker/ai-bots'

console.log(AI_ROBOTS_TXT)
// Output:
// User-agent: GPTBot
// User-agent: ChatGPT-User
// User-agent: Bytespider
// User-agent: CCBot
// ...
// Disallow: /

const app = new Hono()

app.use('/robots.txt', (c) => {
    robotsTxt = AI_ROBOTS_TXT + "\nUser-agent: GoogleBot\nAllow: /"
    return c.text(robotsTxt, 200)
    // Output:
    // User-agent: GPTBot
    // User-agent: ChatGPT-User
    // User-agent: Bytespider
    // User-agent: CCBot
    // ...
    // Disallow: /
    // User-agent: GoogleBot
    // Allow: /
})
```

## API

### `@hono/ua-blocker`

#### `uaBlocker(options)`

Middleware that blocks requests based on their User-Agent header.

**Parameters:**
- `options.blocklist` (`string[]`, default: `[]`) - The list of user-agents to block

**Returns:** Hono middleware function


### `@hono/ua-blocker/ai-bots`

#### `aiBots`

Pre-made list of AI bots user-agents sourced from [ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt),
ready to be passed to `uaBlocker()`.

#### `nonRespectingAiBots`

Subset of the [`aiBots`](#aibots) list, allowing bots that are known to respect `robots.txt` directives.

#### `AI_ROBOTS_TXT`

robots.txt content that disallows all known AI bots.

#### `useAiRobotsTxt()`

Middleware that serves the generated robots.txt content for known AI bots.

**Returns:** Hono middleware function

## Author

finxol <https://github.com/finxol>

## License

MIT
