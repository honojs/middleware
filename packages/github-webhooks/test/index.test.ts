import { sign } from '@octokit/webhooks-methods'
import { Hono } from 'hono'
import { expect, test, vi } from 'vitest'

import { gitHubWebhooksMiddleware } from '../src'

const ENV_VARS = {
  GITHUB_WEBHOOK_SECRET: 'GITHUB_WEBHOOK_SECRET',
}

test("webhooks.on('star.created') is called when repo star payload is verified", async () => {
  // Simple payload for testing purposes
  const body = JSON.stringify({
    action: 'created',
  })

  // We sign the payload with the secret to simulate a real GitHub webhook request
  const signature = await sign(ENV_VARS.GITHUB_WEBHOOK_SECRET, body)

  const webhookHandler = vi.fn()
  const app = new Hono()

  app.use('/webhook', gitHubWebhooksMiddleware({ secret: ENV_VARS.GITHUB_WEBHOOK_SECRET }))

  app.post('/webhook', async (c) => {
    const webhooks = c.var.webhooks
    webhooks.on('star.created', webhookHandler)
  })

  const res = await app.request('/webhook', {
    method: 'POST',
    headers: {
      'x-github-delivery': 'random-id-assigned-by-github',
      'x-hub-signature-256': signature,
      'x-github-event': 'star',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action: 'created' }),
  })

  expect(res.status).toBe(201)
  expect(webhookHandler).toHaveBeenCalledOnce()
})
