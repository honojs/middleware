import { Hono } from 'hono'
import { parseCborFromHonoRequest, renderCborWithContext } from '.'
import { encode, decode } from 'cbor2'

const testObject = {
  message: 'Hello CBOR!',
}

describe('CBOR helper', () => {
  const app = new Hono()

  // Return the test object as CBOR
  app.get('/', async (c) => {
    return renderCborWithContext(c, testObject)
  })

  // Receive a CBOR object, decode it to JSON, and return the JSON response
  app.post('/', async (c) => {
    return c.json(await parseCborFromHonoRequest(c.req))
  })

  test('Should be encoded to CBOR', async () => {
    const response = await app.request('/')
    expect(response.headers.get('Content-Type')).toBe('application/cbor')

    const readResult = await response.body?.getReader().read()
    const encodedObject = readResult?.value
    expect(encodedObject).toBeDefined()

    if (encodedObject !== undefined) {
      const actualObject = decode(encodedObject)
      expect(actualObject).toEqual(testObject)
    }
  })

  test('Should be decoded from CBOR', async () => {
    const response = await app.request('/', {
      method: 'POST',
      headers: {
        contentType: 'application/cbor',
      },
      body: encode(testObject),
    })
    expect(await response.json()).toEqual(testObject)
  })
})
