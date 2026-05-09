import { Hono } from 'hono'
import { stripeWebhook } from '.'

const constructEventAsync = vi.fn()

vi.mock('stripe', () => {
  class StripeMock {
    webhooks = { constructEventAsync }
  }
  return { default: StripeMock }
})

describe('Stripe webhook middleware', () => {
  const secret = 'whsec_test'
  const buildApp = () => {
    const app = new Hono()
    app.post('/webhook', stripeWebhook({ secret }), (c) => {
      const event = c.get('stripeEvent')
      return c.json({ type: event.type })
    })
    return app
  }

  it('Should reject requests without a stripe-signature header', async () => {
    const app = buildApp()
    const res = await app.request('/webhook', {
      method: 'POST',
      body: '{}',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid webhook signature' })
    expect(constructEventAsync).not.toHaveBeenCalled()
  })

  it('Should return 400 when signature verification fails', async () => {
    constructEventAsync.mockRejectedValueOnce(new Error('bad sig'))
    const app = buildApp()
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body: '{}',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid webhook signature' })
  })

  it('Should expose the verified event on the context and continue', async () => {
    const event = { id: 'evt_1', type: 'payment_intent.succeeded' }
    constructEventAsync.mockResolvedValueOnce(event)
    const app = buildApp()
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body: '{"id":"evt_1"}',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ type: 'payment_intent.succeeded' })
    expect(constructEventAsync).toHaveBeenCalledWith(
      '{"id":"evt_1"}',
      't=1,v1=deadbeef',
      secret,
      300
    )
  })

  it('Should forward a custom tolerance to constructEventAsync', async () => {
    constructEventAsync.mockResolvedValueOnce({ id: 'evt_2', type: 'charge.refunded' })
    const app = new Hono()
    app.post('/webhook', stripeWebhook({ secret, tolerance: 60 }), (c) => c.text('ok'))
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(constructEventAsync).toHaveBeenLastCalledWith(
      'payload',
      't=1,v1=deadbeef',
      secret,
      60
    )
  })

  it('Should return 400 when the timestamp is outside the tolerance window', async () => {
    constructEventAsync.mockRejectedValueOnce(
      new Error('Timestamp outside the tolerance zone')
    )
    const app = buildApp()
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body: '{}',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid webhook signature' })
  })

  it('Should leave the original request body readable by downstream handlers', async () => {
    const payload = '{"id":"evt_3","type":"customer.created"}'
    constructEventAsync.mockResolvedValueOnce({ id: 'evt_3', type: 'customer.created' })
    const app = new Hono()
    app.post('/webhook', stripeWebhook({ secret }), async (c) => {
      const body = await c.req.text()
      return c.json({ body })
    })
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body: payload,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ body: payload })
  })
})
