import type { MiddlewareHandler } from 'hono'
import Stripe from 'stripe'

export type StripeWebhookVariables = {
  stripeEvent: Stripe.Event
}

type Options = {
  secret: string
  tolerance?: number
  apiVersion?: Stripe.LatestApiVersion
}

export const stripeWebhook = (options: Options): MiddlewareHandler => {
  const { secret, tolerance = 300, apiVersion = '2025-02-24.acacia' } = options
  const stripe = new Stripe(secret, { apiVersion })

  return async (c, next) => {
    const signature = c.req.header('stripe-signature')

    if (!signature) {
      return c.json({ error: 'Invalid webhook signature' }, 400)
    }

    const rawBody = await c.req.raw.clone().text()

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        secret,
        tolerance
      )
    } catch {
      return c.json({ error: 'Invalid webhook signature' }, 400)
    }

    c.set('stripeEvent', event)
    return next()
  }
}
