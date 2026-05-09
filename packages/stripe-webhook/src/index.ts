import type { MiddlewareHandler } from 'hono'
import Stripe from 'stripe'

export type StripeWebhookVariables = {
  stripeEvent: Stripe.Event
}

declare module 'hono' {
  interface ContextVariableMap {
    stripeEvent: Stripe.Event
  }
}

type Options = {
  secret: string
  tolerance?: number
}

export const stripeWebhook = (options: Options): MiddlewareHandler => {
  const { secret, tolerance = 300 } = options
  const stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' })

  return async (c, next) => {
    const rawBody = await c.req.raw.clone().text()
    const signature = c.req.header('stripe-signature')

    if (!signature) {
      return c.json({ error: 'Invalid webhook signature' }, 400)
    }

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
