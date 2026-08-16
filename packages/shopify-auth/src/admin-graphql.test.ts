import {
  adminGraphql,
  DEFAULT_API_VERSION,
  ShopifyAccessDeniedError,
  ShopifyGraphqlError,
} from './admin-graphql'
import { SHOP } from './test-utils'

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

/** Each of these builds a *fresh* Response per call, so a body is never read twice. */
const respond = (body: string, status: number) => () =>
  Promise.resolve(new Response(body, { status }))
const respondJson = (payload: unknown) => () => Promise.resolve(Response.json(payload))
const respondData = (data: unknown) => respondJson({ data })

const unauthorized = respond('invalid token', 401)

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>(respondData({ shop: { name: 'Example' } }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const call = (overrides: Partial<Parameters<typeof adminGraphql>[0]> = {}) =>
  adminGraphql({ shop: SHOP, accessToken: 'shpua_token', query: '{ shop { name } }', ...overrides })

describe('adminGraphql', () => {
  it('returns the data payload', async () => {
    await expect(call()).resolves.toEqual({ shop: { name: 'Example' } })
  })

  it('posts to the versioned endpoint with the access token', async () => {
    await call()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://${SHOP}/admin/api/${DEFAULT_API_VERSION}/graphql.json`)
    expect((init.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe('shpua_token')
    expect(JSON.parse(init.body as string)).toEqual({ query: '{ shop { name } }', variables: {} })
  })

  it('honours a custom API version', async () => {
    await call({ apiVersion: '2025-01' })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('/admin/api/2025-01/')
  })

  it('passes variables through', async () => {
    await call({ variables: { handle: 'a-product' } })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { variables: unknown }
    expect(body.variables).toEqual({ handle: 'a-product' })
  })

  describe('errors', () => {
    it('throws ShopifyGraphqlError on a 500', async () => {
      fetchMock.mockImplementation(respond('boom', 500))
      await expect(call()).rejects.toBeInstanceOf(ShopifyGraphqlError)
    })

    it('throws ShopifyAccessDeniedError on a 403', async () => {
      fetchMock.mockImplementation(respond('nope', 403))
      await expect(call()).rejects.toBeInstanceOf(ShopifyAccessDeniedError)
    })

    it('throws on top-level GraphQL errors', async () => {
      fetchMock.mockImplementation(respondJson({ errors: [{ message: 'bad' }] }))
      await expect(call()).rejects.toBeInstanceOf(ShopifyGraphqlError)
    })

    it('classifies ACCESS_DENIED as an access error', async () => {
      fetchMock.mockImplementation(
        respondJson({ errors: [{ message: 'denied', extensions: { code: 'ACCESS_DENIED' } }] })
      )
      await expect(call()).rejects.toBeInstanceOf(ShopifyAccessDeniedError)
    })

    it('does not treat userErrors as fatal', async () => {
      fetchMock.mockImplementation(
        respondData({ productCreate: { userErrors: [{ message: 'Title is required' }] } })
      )
      await expect(call()).resolves.toEqual({
        productCreate: { userErrors: [{ message: 'Title is required' }] },
      })
    })

    it('exposes the status on the thrown error', async () => {
      fetchMock.mockImplementation(respond('boom', 502))
      await expect(call()).rejects.toMatchObject({ status: 502, name: 'ShopifyGraphqlError' })
    })

    it('exposes the GraphQL errors on the thrown error', async () => {
      fetchMock.mockImplementation(respondJson({ errors: [{ message: 'bad' }] }))
      await expect(call()).rejects.toMatchObject({ errors: [{ message: 'bad' }] })
    })
  })

  describe('recovery from a revoked token', () => {
    it('re-exchanges once and retries', async () => {
      fetchMock
        .mockImplementationOnce(unauthorized)
        .mockImplementationOnce(respondData({ shop: { name: 'Example' } }))
      const reExchange = vi.fn(() => Promise.resolve<string | null>('shpua_fresh'))

      await expect(call({ reExchange })).resolves.toEqual({ shop: { name: 'Example' } })
      expect(reExchange).toHaveBeenCalledTimes(1)

      const [, retry] = fetchMock.mock.calls[1] as [string, RequestInit]
      expect((retry.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe(
        'shpua_fresh'
      )
    })

    it('gives up when re-exchange yields nothing', async () => {
      fetchMock.mockImplementation(unauthorized)
      const reExchange = vi.fn(() => Promise.resolve<string | null>(null))

      await expect(call({ reExchange })).rejects.toBeInstanceOf(ShopifyAccessDeniedError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('retries at most once', async () => {
      fetchMock.mockImplementation(unauthorized)
      const reExchange = vi.fn(() => Promise.resolve<string | null>('shpua_fresh'))

      await expect(call({ reExchange })).rejects.toBeInstanceOf(ShopifyAccessDeniedError)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(reExchange).toHaveBeenCalledTimes(1)
    })

    it('throws without retrying when no reExchange is supplied', async () => {
      fetchMock.mockImplementation(unauthorized)
      await expect(call()).rejects.toBeInstanceOf(ShopifyAccessDeniedError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
