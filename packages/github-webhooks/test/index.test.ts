import { sign } from '@octokit/webhooks-methods'
import { Hono } from 'hono'
import { describe, expect, test, vi } from 'vitest'

import { gitHubWebhooksMiddleware } from '../src'

const ENV_VARS = {
  GITHUB_WEBHOOK_SECRET: 'GITHUB_WEBHOOK_SECRET',
}

describe('GitHub Webhooks Middleware', () => {
  test('rejects incoming request when the GitHub Webhook secret key is missing', async () => {
    const app = new Hono()

    app.use('/webhook', gitHubWebhooksMiddleware())

    const res = await app.request('/webhook', {
      method: 'POST',
    })

    expect(res.status).toBe(403)
  })

  test('rejects incoming request when the signed secret is incorrect', async () => {
    const app = new Hono()

    app.use('/webhook', gitHubWebhooksMiddleware({ secret: ENV_VARS.GITHUB_WEBHOOK_SECRET }))

    const FAULTY_SIGNATURE = 'sha256=faulty-signature'

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'random-id-assigned-by-github',
        'x-hub-signature-256': FAULTY_SIGNATURE,
        'x-github-event': 'star',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'created' }),
    })

    expect(res.status).toBe(400)
  })

  test("webhooks.on('star.created') is called when repo star payload is verified", async () => {
    // Simple payload for testing purposes
    const body = JSON.stringify({
      action: 'created',
    })

    // We sign the payload with the secret to simulate a real GitHub webhook request
    const signature = await sign(ENV_VARS.GITHUB_WEBHOOK_SECRET, body)
    const starCreationHandler = vi.fn()
    const irrelevantHandler = vi.fn()

    const app = new Hono()

    app.use('/webhook', gitHubWebhooksMiddleware({ secret: ENV_VARS.GITHUB_WEBHOOK_SECRET }))

    app.post('/webhook', async (c) => {
      const webhooks = c.var.webhooks
      webhooks.on('star.created', starCreationHandler)
      webhooks.on('discussion.created', irrelevantHandler)
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
    expect(starCreationHandler).toHaveBeenCalledOnce()
    expect(irrelevantHandler).not.toHaveBeenCalled()
  })

  test("webhooks.on('issues.opened') is called when repo issue payload is verified", async () => {
    const body = JSON.stringify({
      action: 'opened',
    })

    const signature = await sign(ENV_VARS.GITHUB_WEBHOOK_SECRET, body)
    const issuesOpenedHandler = vi.fn()
    const irrelevantHandler = vi.fn()

    const app = new Hono()

    app.use('/webhook', gitHubWebhooksMiddleware({ secret: ENV_VARS.GITHUB_WEBHOOK_SECRET }))

    app.post('/webhook', async (c) => {
      const webhooks = c.var.webhooks
      webhooks.on('issues.opened', issuesOpenedHandler)
      webhooks.on('project.closed', irrelevantHandler)
    })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'random-id-assigned-by-github',
        'x-hub-signature-256': signature,
        'x-github-event': 'issues',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'opened' }),
    })

    expect(res.status).toBe(201)
    expect(issuesOpenedHandler).toHaveBeenCalledOnce()
    expect(irrelevantHandler).not.toHaveBeenCalled()
  })
})
