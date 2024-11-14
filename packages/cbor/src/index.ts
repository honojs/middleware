import { decode, encode } from 'cbor2'
import { HonoRequest, type Context } from 'hono'
import { ResponseHeader } from 'hono/utils/headers'
import { StatusCode } from 'hono/utils/http-status'
import { BaseMime } from 'hono/utils/mime'

type HeaderRecord =
  | Record<'Content-Type', BaseMime>
  | Record<ResponseHeader, string | string[]>
  | Record<string, string | string[]>

/**
 * Render CBOR as `Content-Type:application/cbor` with the `Context` object.
 *
 * @param c - The `Context` object for Hono.
 * @param object - The object to render as CBOR.
 * @param arg - The status code or response init object.
 * @param headers - The headers to set in the response.
 * @returns The response object with the rendered CBOR.
 *
 * @example
 * ```ts
 * app.get('/api', (c) => {
 *   return renderCborWithContext(c, { message: 'Hello CBOR!' })
 * })
 * ```
 */
export const renderCborWithContext = (
  c: Context,
  object: any,
  arg?: StatusCode | ResponseInit,
  headers?: HeaderRecord
) => {
  const encodedObject = encode(object)
  const body = encodedObject.buffer
  c.header('Content-Type', 'application/cbor')
  return typeof arg === 'number' ? c.newResponse(body, arg, headers) : c.newResponse(body, arg)
}

/**
 * Parse the request body of type `application/cbor` from the `HonoRequest` object.
 *
 * @template T - The type of the parsed object.
 * @param req - The `HonoRequest` object to parse.
 * @returns A promise that resolves to the parsed object.
 *
 * @example
 * ```ts
 * app.post('/entry', (c) => {
 *   const body = await parseCborFromHonoRequest(c.req)
 *   // ...
 * })
 * ```
 */
export const parseCborFromHonoRequest = async <T = any>(req: HonoRequest): Promise<T> => {
  const requestArrayBuffer = await req.arrayBuffer()
  const encodedObject = new Uint8Array(requestArrayBuffer)
  return decode(encodedObject) as T
}
