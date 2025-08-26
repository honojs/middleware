import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type { SSEServerTransportOptions } from '@modelcontextprotocol/sdk/server/sse.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type {
  JSONRPCMessage,
  MessageExtraInfo,
  RequestInfo,
} from '@modelcontextprotocol/sdk/types.js'
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Context } from 'hono'
import type { SSEStreamingApi } from 'hono/streaming'
import { randomUUID } from 'node:crypto'

/**
 * Server transport for SSE: this will send messages over an SSE connection and receive messages from HTTP POST requests.
 *
 * @experimental This class is under development and its API may change.
 * Use with caution.
 */
export class SSEServerTransport implements Transport {
  private stream?: SSEStreamingApi
  private _sessionId: string
  private options: SSEServerTransportOptions
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void

  /**
   * Creates a new SSE server transport, which will direct the client to POST messages to the relative or absolute URL identified by `endpoint`.
   */
  constructor(
    private endpoint: string,
    options?: SSEServerTransportOptions
  ) {
    this._sessionId = randomUUID()
    this.options = options || { enableDnsRebindingProtection: false }
  }

  /**
   * Validates request headers for DNS rebinding protection.
   * @returns Error message if validation fails, undefined if validation passes.
   */
  private validateRequestHeaders(c: Context): string | undefined {
    // Skip validation if protection is not enabled
    if (!this.options.enableDnsRebindingProtection) {
      return undefined
    }

    // Validate Host header if allowedHosts is configured
    if (this.options.allowedHosts && this.options.allowedHosts.length > 0) {
      const hostHeader = c.req.header('Host')
      if (!hostHeader || !this.options.allowedHosts.includes(hostHeader)) {
        return `Invalid Host header: ${hostHeader}`
      }
    }

    // Validate Origin header if allowedOrigins is configured
    if (this.options.allowedOrigins && this.options.allowedOrigins.length > 0) {
      const originHeader = c.req.header('Origin')
      if (!originHeader || !this.options.allowedOrigins.includes(originHeader)) {
        return `Invalid Origin header: ${originHeader}`
      }
    }

    return undefined
  }

  /**
   * Handles the initial SSE connection request.
   *
   * This should be called when a GET request is made to establish the SSE stream.
   */
  async start(): Promise<void> {
    if (this.stream) {
      throw new Error(
        'SSEServerTransport already started! If using Server class, note that connect() calls start() automatically.'
      )
    }
  }

  handleStream(): (stream: SSEStreamingApi) => void {
    // Send the endpoint event
    // Use a dummy base URL because this.endpoint is relative.
    // This allows using URL/URLSearchParams for robust parameter handling.
    const dummyBase = 'http://localhost' // Any valid base works
    const endpointUrl = new URL(this.endpoint, dummyBase)
    endpointUrl.searchParams.set('sessionId', this._sessionId)

    // Reconstruct the relative URL string (pathname + search + hash)
    const relativeUrlWithSession = endpointUrl.pathname + endpointUrl.search + endpointUrl.hash

    return (stream) => {
      stream.writeSSE({ data: relativeUrlWithSession, event: 'endpoint' })

      this.stream = stream

      stream.onAbort(() => {
        this.stream = undefined
        this.onclose?.()
      })
    }
  }

  /**
   * Handles incoming POST messages.
   *
   * This should be called when a POST request is made to send a message to the server.
   */
  async handlePostMessage(
    c: Context<{ Variables: { auth: AuthInfo } }>,
    parsedBody?: unknown
  ): Promise<Response> {
    if (!this.stream) {
      const message = 'SSE connection not established'
      return c.text(message, 500)
    }

    // Validate request headers for DNS rebinding protection
    const validationError = this.validateRequestHeaders(c)
    if (validationError) {
      this.onerror?.(new Error(validationError))
      return c.text(validationError, 403)
    }

    const authInfo = c.get('auth')
    const requestInfo: RequestInfo = { headers: c.req.header() }

    let body: string | unknown
    try {
      const contentType = c.req.header('content-type') ?? ''
      if (contentType !== 'application/json') {
        throw new Error(`Unsupported content-type: ${contentType}`)
      }

      body = parsedBody ?? (await c.req.json())
    } catch (error) {
      this.onerror?.(error as Error)
      return c.text(String(error), 400)
    }

    try {
      await this.handleMessage(typeof body === 'string' ? JSON.parse(body) : body, {
        requestInfo,
        authInfo,
      })
    } catch {
      return c.text(`Invalid message: ${body}`, 400)
    }

    return c.text('Accepted', 202)
  }

  /**
   * Handle a client message, regardless of how it arrived. This can be used to inform the server of messages that arrive via a means different than HTTP POST.
   */
  async handleMessage(message: unknown, extra?: MessageExtraInfo): Promise<void> {
    let parsedMessage: JSONRPCMessage
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message)
    } catch (error) {
      this.onerror?.(error as Error)
      throw error
    }

    this.onmessage?.(parsedMessage, extra)
  }

  async close(): Promise<void> {
    this.stream?.abort()
    this.stream = undefined
    this.onclose?.()
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.stream) {
      throw new Error('Not connected')
    }

    this.stream.writeSSE({ data: JSON.stringify(message), event: 'message' })
  }

  /**
   * Returns the session ID for this transport.
   *
   * This can be used to route incoming POST requests.
   */
  get sessionId(): string {
    return this._sessionId
  }
}
