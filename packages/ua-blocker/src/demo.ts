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