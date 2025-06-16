import { Hono } from 'hono'
import { uaBlocker } from '../src'
import { nonRespectingAiBots, useAiRobotsTxt } from '../src/ai-bots'

const app = new Hono()

app.use(
  '*',
  uaBlocker({
    blocklist: nonRespectingAiBots,
  })
)
// serve robots.txt
app.use('/robots.txt', useAiRobotsTxt())
app.get('/', (c) => c.text('Hello World'))

export default app
