import { Webhooks } from '@octokit/webhooks'
import type { Options, WebhookEventName } from '@octokit/webhooks/dist-types/types'
import { env } from 'hono/adapter'
import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono/types'

type GithubWebhooksMiddleware = (options?: Options) => MiddlewareHandler

type GithubWebhooksEnv = {
  GITHUB_WEBHOOK_SECRET: string
}

/**
 * Middleware to verify and handle Github Webhook requests. It exposes the
 * `webhooks` object on the context.
 */
export const githubWebhooksMiddleware: GithubWebhooksMiddleware = (options) =>
  createMiddleware(async (c, next) => {
    const { GITHUB_WEBHOOK_SECRET } = env<GithubWebhooksEnv>(c)
    const { secret, ...rest } = options || {
      secret: GITHUB_WEBHOOK_SECRET,
    }

    if (!secret) {
      throw new Error('Missing Github Webhook Secret key')
    }

    const webhooks = new Webhooks({ secret, ...rest })

    c.set('webhooks', webhooks)

    await next()

    const id = c.req.header('x-github-delivery')
    const signature = c.req.header('x-hub-signature-256')
    const name = c.req.header('x-github-event') as WebhookEventName

    if (!(id && name && signature)) {
      return c.text('Invalid webhook request', 403)
    }

    const payload = await c.req.text()

    try {
      await webhooks.verifyAndReceive({
        id,
        name,
        signature,
        payload,
      })
      return c.text('Webhook received & verified', 201)
    } catch (error) {
      return c.text(`Failed to verify Github Webhook request: ${error}`, 400)
    }
  })
