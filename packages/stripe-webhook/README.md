# Stripe Webhook Middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=stripe-webhook)](https://codecov.io/github/honojs/middleware)

This middleware integrates [Hono](https://github.com/honojs/hono) with [Stripe](https://stripe.com) webhook signature verification. It validates the `stripe-signature` header against the raw request body using [stripe-node](https://github.com/stripe/stripe-node) and exposes the verified `Stripe.Event` on the request context.

## Installation

```plain
npm i hono stripe @hono/stripe-webhook
```

## Configuration

Provide your endpoint signing secret (e.g. `whsec_...`) to the middleware. On Cloudflare Workers, set a binding named `STRIPE_WEBHOOK_SECRET` and read it from `c.env`. For instance, during development, you can specify this in `.dev.vars`:

```plain
STRIPE_WEBHOOK_SECRET=whsec_...
```

On other platforms, you can directly provide the secret by passing it as an option:

```ts
stripeWebhook({
  secret: '<Your signing secret>',
})
```

## How to Use

```ts
import { Hono } from 'hono'
import { stripeWebhook } from '@hono/stripe-webhook'

const app = new Hono()

app.post('/webhook', stripeWebhook({ secret: process.env.STRIPE_WEBHOOK_SECRET! }), (c) => {
  const event = c.get('stripeEvent')
  if (event.type === 'payment_intent.succeeded') {
    // handle the event
  }
  return c.json({ received: true })
})

export default app
```

Options:

| Option       | Type                       | Default                | Description                                                                       |
| ------------ | -------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `secret`     | `string`                   | —                      | Required. Your Stripe webhook endpoint signing secret (`whsec_...`).              |
| `tolerance`  | `number`                   | `300`                  | Maximum age (in seconds) of the signed timestamp before the request is rejected. |
| `apiVersion` | `Stripe.LatestApiVersion`  | `'2025-02-24.acacia'`  | Stripe API version pinned on the internal `Stripe` client.                        |

### Accessing the verified event

You can retrieve the verified `Stripe.Event` using `c.get('stripeEvent')`.

```ts
app.post('/webhook', stripeWebhook({ secret }), async (c) => {
  const event = c.get('stripeEvent')
  switch (event.type) {
    case 'checkout.session.completed':
      // ...
      break
    case 'invoice.payment_failed':
      // ...
      break
  }
  return c.json({ received: true })
})
```

### Why `clone()` is used to read the body

Stripe signature verification must run against the **raw, byte-for-byte** request body. The middleware reads the body with `c.req.raw.clone().text()` so the original `Request` stream stays untouched and downstream handlers can still call `c.req.text()`, `c.req.json()`, or read `c.req.raw.body` themselves. Without `clone()`, the body stream would be consumed by the middleware and any subsequent read would throw.

## Authors

- Sola Samuel - <https://github.com/solasamuel>

## License

MIT
