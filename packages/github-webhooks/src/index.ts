import { Webhooks } from '@octokit/webhooks'
import type { Options, WebhookEventName } from '@octokit/webhooks/dist-types/types'
import { env } from 'hono/adapter'
import { createMiddleware } from 'hono/factory'

export type GitHubWebhooksEnv = {
  GITHUB_WEBHOOK_SECRET: string
}

declare module 'hono' {
  interface ContextVariableMap {
    webhooks: InstanceType<typeof Webhooks>
  }
}

/**
 * Middleware to receive & validate GitHub webhook requests by verifying their signatures. It
 * exposes the `webhooks` instance in the context variable map, and allows you to listen to specific
 * events using the `webhooks.on`, `webhooks.onAny`, or `webhooks.onError` methods.
 *
 * @see [Octokit Webhooks documentation](https://github.com/octokit/webhooks.js)
 *
 * The webhooks instance can be accessed via `c.get('webhooks')` in the route handler.
 *
 * @example
 * type Env = {
 *   GITHUB_WEBHOOK_SECRET: string
 * }
 *
 * const app = new Hono<{ Bindings: Env }>()
 *
 * app.use("/webhook", GitHubWebhooksMiddleware())
 *
 * app.post("/webhook", async (c) => {
 *   const webhooks = c.get("webhooks")
 *
 *   webhooks.on("star.created", async ({ id, name, payload }) => {
 *     console.log(`Received ${name} event with id ${id} and payload: ${payload}`)
 *   })
 * })
 */
export const gitHubWebhooksMiddleware = (options?: Options) =>
  createMiddleware(async (c, next) => {
    const { GITHUB_WEBHOOK_SECRET } = env<GitHubWebhooksEnv>(c)
    const { secret, ...rest } = options || {
      secret: GITHUB_WEBHOOK_SECRET,
    }

    if (!secret) {
      throw new Error('Missing GitHub Webhook secret key')
    }

    const webhooks = new Webhooks({ secret, ...rest })

    c.set('webhooks', webhooks)

    await next()

    const id = c.req.header('x-github-delivery')
    const signature = c.req.header('x-hub-signature-256')
    const name = c.req.header('x-github-event') as WebhookEventName | undefined

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
      return c.text(`Failed to verify GitHub Webhook request: ${error}`, 400)
    }
  })
