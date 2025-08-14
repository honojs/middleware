/**
 * @module
 * MCP HTTP Streaming Helper for Hono.
 */
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type {
  EventStore,
  StreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type {
  JSONRPCMessage,
  MessageExtraInfo,
  RequestId,
  RequestInfo,
} from '@modelcontextprotocol/sdk/types.js'
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  isInitializeRequest,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCMessageSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { SSEStreamingApi } from 'hono/streaming'
import { streamSSE } from './streaming'

export class StreamableHTTPTransport implements Transport {
  #started = false
  #initialized = false
  #onSessionInitialized?: (sessionId: string) => void | Promise<void>
  #onSessionClosed?: (sessionId: string) => void | Promise<void>
  #sessionIdGenerator?: () => string
  #eventStore?: EventStore
  #enableJsonResponse = false
  #standaloneSseStreamId = '_GET_stream'
  #streamMapping = new Map<
    string,
    {
      ctx: {
        header: (name: string, value: string) => void
        json: (data: unknown) => void
      }
      stream?: SSEStreamingApi
    }
  >()
  #requestToStreamMapping = new Map<RequestId, string>()
  #requestResponseMap = new Map<RequestId, JSONRPCMessage>()
  #allowedHosts?: string[]
  #allowedOrigins?: string[]
  #enableDnsRebindingProtection: boolean

  sessionId?: string
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void

  constructor(options?: StreamableHTTPServerTransportOptions) {
    this.#sessionIdGenerator = options?.sessionIdGenerator
    this.#enableJsonResponse = options?.enableJsonResponse ?? false
    this.#eventStore = options?.eventStore
    this.#onSessionInitialized = options?.onsessioninitialized
    this.#onSessionClosed = options?.onsessionclosed
    this.#allowedHosts = options?.allowedHosts
    this.#allowedOrigins = options?.allowedOrigins
    this.#enableDnsRebindingProtection = options?.enableDnsRebindingProtection ?? false
  }

  /**
   * Starts the transport. This is required by the Transport interface but is a no-op
   * for the Streamable HTTP transport as connections are managed per-request.
   */
  async start(): Promise<void> {
    if (this.#started) {
      throw new Error('Transport already started')
    }
    this.#started = true
  }

  /**
   * Normalizes a host header value for comparison
   */
  #normalizeHost(host: string | undefined): string | undefined {
    if (!host) {
      return undefined
    }

    let normalized = host.trim().toLowerCase()

    // Remove trailing dot
    if (normalized.endsWith('.')) {
      normalized = normalized.slice(0, -1)
    }

    // Handle IPv6 addresses
    if (normalized.startsWith('[') && normalized.includes(']:')) {
      const bracketEnd = normalized.lastIndexOf(']:')
      const address = normalized.slice(1, bracketEnd)
      const port = normalized.slice(bracketEnd + 2)
      // Normalize IPv6-mapped IPv4 addresses
      if (address.startsWith('::ffff:')) {
        const ipv4Part = address.slice(7)
        normalized = `${ipv4Part}:${port}`
      } else {
        normalized = `[${address}]:${port}`
      }
    }

    return normalized
  }

  /**
   * Validates request headers for DNS rebinding protection.
   * @returns Error message if validation fails, undefined if validation passes.
   */
  #validateRequestHeaders(ctx: Context): string | undefined {
    // Skip validation if protection is not enabled
    if (!this.#enableDnsRebindingProtection) {
      return undefined
    }

    // Validate Host header if allowedHosts is configured
    if (this.#allowedHosts && this.#allowedHosts.length > 0) {
      const hostHeader = ctx.req.header('Host')
      const normalizedHost = this.#normalizeHost(hostHeader)
      const normalizedAllowedHosts = this.#allowedHosts.map((h) => this.#normalizeHost(h))

      if (!normalizedHost || !normalizedAllowedHosts.includes(normalizedHost)) {
        return `Invalid Host header: ${hostHeader}`
      }
    }

    // Validate Origin header if allowedOrigins is configured
    if (this.#allowedOrigins && this.#allowedOrigins.length > 0) {
      const originHeader = ctx.req.header('Origin')
      if (!originHeader || !this.#allowedOrigins.includes(originHeader)) {
        return `Invalid Origin header: ${originHeader}`
      }
    }

    return undefined
  }

  /**
   * Handles an incoming HTTP request, whether GET or POST
   */
  async handleRequest(ctx: Context, parsedBody?: unknown): Promise<Response | undefined> {
    // Validate request headers for DNS rebinding protection
    const validationError = this.#validateRequestHeaders(ctx)
    if (validationError) {
      throw new HTTPException(403, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: validationError,
          },
          id: null,
        }),
      })
    }

    switch (ctx.req.method) {
      case 'GET':
        return this.handleGetRequest(ctx)
      case 'POST':
        return this.handlePostRequest(ctx, parsedBody)
      case 'DELETE':
        return this.handleDeleteRequest(ctx)
      default:
        return this.handleUnsupportedRequest(ctx)
    }
  }

  /**
   * Handles GET requests for SSE stream
   */
  private async handleGetRequest(ctx: Context) {
    try {
      // The client MUST include an Accept header, listing text/event-stream as a supported content type.
      const acceptHeader = ctx.req.header('Accept')
      if (!acceptHeader?.includes('text/event-stream')) {
        throw new HTTPException(406, {
          res: Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Not Acceptable: Client must accept text/event-stream',
            },
            id: null,
          }),
        })
      }

      // If an Mcp-Session-Id is returned by the server during initialization,
      // clients using the Streamable HTTP transport MUST include it
      // in the Mcp-Session-Id header on all of their subsequent HTTP requests.
      this.#validateSession(ctx)
      // Only validate protocol version if session management is enabled
      if (this.#sessionIdGenerator !== undefined) {
        this.#validateProtocolVersion(ctx)
      }

      // After initialization, always include the session ID if we have one
      if (this.sessionId !== undefined) {
        ctx.header('mcp-session-id', this.sessionId)
      }

      let streamId: string | ((stream: SSEStreamingApi) => Promise<string>) =
        this.#standaloneSseStreamId

      // Handle resumability: check for Last-Event-ID header
      if (this.#eventStore) {
        const lastEventId = ctx.req.header('last-event-id')
        if (lastEventId) {
          streamId = (stream) =>
            this.#eventStore!.replayEventsAfter(lastEventId, {
              send: async (eventId: string, message: JSONRPCMessage) => {
                try {
                  await stream.writeSSE({
                    id: eventId,
                    event: 'message',
                    data: JSON.stringify(message),
                  })
                } catch {
                  this.onerror?.(new Error('Failed replay events'))
                  throw new HTTPException(500, {
                    message: 'Failed replay events',
                  })
                }
              },
            })
        }
      }

      // Check if there's already an active standalone SSE stream for this session
      if (typeof streamId === 'string' && this.#streamMapping.get(streamId) !== undefined) {
        // Only one GET SSE stream is allowed per session
        throw new HTTPException(409, {
          res: Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Conflict: Only one SSE stream is allowed per session',
            },
            id: null,
          }),
        })
      }

      return streamSSE(ctx, async (stream) => {
        const resolvedStreamId = typeof streamId === 'string' ? streamId : await streamId(stream)

        // Assign the response to the standalone SSE stream
        this.#streamMapping.set(resolvedStreamId, {
          ctx,
          stream,
        })

        // Keep connection alive
        const keepAlive = setInterval(() => {
          if (!stream.closed) {
            stream.writeSSE({ data: '', event: 'ping' }).catch(() => {
              clearInterval(keepAlive)
            })
          }
        }, 30000)

        // Set up close handler for client disconnects
        stream.onAbort(() => {
          this.#streamMapping.delete(resolvedStreamId)
          clearInterval(keepAlive)
        })
      })
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      this.onerror?.(error as Error)

      // return JSON-RPC formatted error
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: String(error),
          },
          id: null,
        }),
      })
    }
  }

  /**
   * Handles POST requests containing JSON-RPC messages
   */
  private async handlePostRequest(ctx: Context, parsedBody?: unknown) {
    try {
      // Validate the Accept header
      const acceptHeader = ctx.req.header('Accept')
      // The client MUST include an Accept header, listing both application/json and text/event-stream as supported content types.
      if (
        !acceptHeader?.includes('application/json') ||
        !acceptHeader.includes('text/event-stream')
      ) {
        throw new HTTPException(406, {
          res: Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message:
                'Not Acceptable: Client must accept both application/json and text/event-stream',
            },
            id: null,
          }),
        })
      }

      const ct = ctx.req.header('Content-Type')
      if (!ct?.includes('application/json')) {
        throw new HTTPException(415, {
          res: Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Unsupported Media Type: Content-Type must be application/json',
            },
            id: null,
          }),
        })
      }

      const authInfo: AuthInfo | undefined = ctx.get('auth')
      const requestInfo: RequestInfo = { headers: ctx.req.header() }

      let rawMessage = parsedBody
      if (rawMessage === undefined) {
        rawMessage = await ctx.req.json()
      }

      let messages: JSONRPCMessage[]

      // handle batch and single messages
      if (Array.isArray(rawMessage)) {
        messages = rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg))
      } else {
        messages = [JSONRPCMessageSchema.parse(rawMessage)]
      }

      // Check if this is an initialization request
      // https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/
      const isInitializationRequest = messages.some(isInitializeRequest)
      if (isInitializationRequest) {
        // If it's a server with session management and the session ID is already set we should reject the request
        // to avoid re-initialization.
        if (this.#initialized && this.sessionId !== undefined) {
          throw new HTTPException(400, {
            res: Response.json({
              jsonrpc: '2.0',
              error: {
                code: -32600,
                message: 'Invalid Request: Server already initialized',
              },
              id: null,
            }),
          })
        }

        if (messages.length > 1) {
          throw new HTTPException(400, {
            res: Response.json({
              jsonrpc: '2.0',
              error: {
                code: -32600,
                message: 'Invalid Request: Only one initialization request is allowed',
              },
              id: null,
            }),
          })
        }
        this.sessionId = this.#sessionIdGenerator?.()
        this.#initialized = true

        // If we have a session ID and an onsessioninitialized handler, call it immediately
        // This is needed in cases where the server needs to keep track of multiple sessions
        if (this.sessionId && this.#onSessionInitialized) {
          try {
            await Promise.resolve(this.#onSessionInitialized(this.sessionId))
          } catch (error) {
            throw new HTTPException(400, {
              res: Response.json({
                jsonrpc: '2.0',
                error: {
                  code: -32000,
                  message: 'Bad Request: Session initialization failed',
                  data: String(error),
                },
                id: null,
              }),
            })
          }
        }
      }

      if (!isInitializationRequest) {
        // If an Mcp-Session-Id is returned by the server during initialization,
        // clients using the Streamable HTTP transport MUST include it
        // in the Mcp-Session-Id header on all of their subsequent HTTP requests.
        this.#validateSession(ctx)
        // Mcp-Protocol-Version header is required for all requests after initialization.
        if (this.#sessionIdGenerator !== undefined) {
          this.#validateProtocolVersion(ctx)
        }
      }

      // check if it contains requests
      const hasRequests = messages.some(isJSONRPCRequest)

      if (!hasRequests) {
        // handle each message
        for (const message of messages) {
          this.onmessage?.(message, { authInfo, requestInfo })
        }

        // if it only contains notifications or responses, return 202
        return ctx.body(null, 202)
      }

      if (hasRequests) {
        // The default behavior is to use SSE streaming
        // but in some cases server will return JSON responses
        const streamId = crypto.randomUUID()

        if (!this.#enableJsonResponse && this.sessionId !== undefined) {
          ctx.header('mcp-session-id', this.sessionId)
        }

        if (this.#enableJsonResponse) {
          // Store the response for this request to send messages back through this connection
          // We need to track by request ID to maintain the connection
          const result = await new Promise<JSONRPCMessage | JSONRPCMessage[]>((resolve) => {
            for (const message of messages) {
              if (isJSONRPCRequest(message)) {
                this.#streamMapping.set(streamId, {
                  ctx: {
                    header: ctx.header,
                    json: resolve,
                  },
                })
                this.#requestToStreamMapping.set(message.id, streamId)
              }
            }

            // handle each message
            for (const message of messages) {
              this.onmessage?.(message, { authInfo, requestInfo })
            }
          })

          return ctx.json(result)
        }

        return streamSSE(ctx, async (stream) => {
          // Store the response for this request to send messages back through this connection
          // We need to track by request ID to maintain the connection
          for (const message of messages) {
            if (isJSONRPCRequest(message)) {
              this.#streamMapping.set(streamId, {
                ctx,
                stream,
              })
              this.#requestToStreamMapping.set(message.id, streamId)
            }
          }

          // Set up close handler for client disconnects
          stream.onAbort(() => {
            this.#streamMapping.delete(streamId)
          })

          // handle each message
          for (const message of messages) {
            this.onmessage?.(message, { authInfo })
          }
          // The server SHOULD NOT close the SSE stream before sending all JSON-RPC responses
          // This will be handled by the send() method when responses are ready
        })
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      this.onerror?.(error as Error)

      // return JSON-RPC formatted error
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: String(error),
          },
          id: null,
        }),
      })
    }
  }

  /**
   * Handles DELETE requests to terminate sessions
   */
  private async handleDeleteRequest(ctx: Context) {
    this.#validateSession(ctx)
    if (this.#sessionIdGenerator !== undefined) {
      this.#validateProtocolVersion(ctx)
    }

    if (this.#onSessionClosed && this.sessionId) {
      try {
        await Promise.resolve(this.#onSessionClosed(this.sessionId))
      } catch (error) {
        throw new HTTPException(500, {
          res: Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Internal Server Error: Session closure failed',
              data: String(error),
            },
            id: null,
          }),
        })
      }
    }

    await this.close()
    return ctx.body(null, 200)
  }

  /**
   * Handles unsupported requests (PUT, PATCH, etc.)
   */
  private handleUnsupportedRequest(ctx: Context) {
    return ctx.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed.',
        },
        id: null,
      },
      {
        status: 405,
        headers: {
          Allow: 'GET, POST, DELETE',
        },
      }
    )
  }

  /**
   * Validates session ID for non-initialization requests
   * Returns true if the session is valid, false otherwise
   */
  #validateSession(ctx: Context): boolean {
    if (this.#sessionIdGenerator === undefined) {
      // If the sessionIdGenerator ID is not set, the session management is disabled
      // and we don't need to validate the session ID
      return true
    }
    if (!this.#initialized) {
      // If the server has not been initialized yet, reject all requests
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Server not initialized',
          },
          id: null,
        }),
      })
    }

    const sessionId = ctx.req.header('mcp-session-id')

    if (!sessionId) {
      // Non-initialization requests without a session ID should return 400 Bad Request
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Mcp-Session-Id header is required',
          },
          id: null,
        }),
      })
    }

    if (Array.isArray(sessionId)) {
      throw new HTTPException(400, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Mcp-Session-Id header must be a single value',
          },
          id: null,
        }),
      })
    }

    if (sessionId !== this.sessionId) {
      // Reject requests with invalid session ID with 404 Not Found
      throw new HTTPException(404, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Session not found',
          },
          id: null,
        }),
      })
    }

    return true
  }

  #validateProtocolVersion(ctx: Context): boolean {
    let protocolVersion =
      ctx.req.header('mcp-protocol-version') ?? DEFAULT_NEGOTIATED_PROTOCOL_VERSION
    if (Array.isArray(protocolVersion)) {
      protocolVersion = protocolVersion[protocolVersion.length - 1]
    }

    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
      throw new HTTPException(404, {
        res: Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`,
          },
          id: null,
        }),
      })
    }
    return true
  }

  async close(): Promise<void> {
    // Close all SSE connections

    for (const { stream } of this.#streamMapping.values()) {
      stream?.close()
    }

    this.#streamMapping.clear()

    // Clear any pending responses
    this.#requestResponseMap.clear()
    this.onclose?.()
  }

  async send(message: JSONRPCMessage, options?: { relatedRequestId?: RequestId }): Promise<void> {
    let requestId = options?.relatedRequestId
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      // If the message is a response, use the request ID from the message
      requestId = message.id
    }

    // Check if this message should be sent on the standalone SSE stream (no request ID)
    // Ignore notifications from tools (which have relatedRequestId set)
    // Those will be sent via dedicated response SSE streams
    if (requestId === undefined) {
      // For standalone SSE streams, we can only send requests and notifications
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error(
          'Cannot send a response on a standalone SSE stream unless resuming a previous client request'
        )
      }
      const standaloneSse = this.#streamMapping.get(this.#standaloneSseStreamId)

      if (standaloneSse === undefined) {
        // The spec says the server MAY send messages on the stream, so it's ok to discard if no stream
        return
      }

      // Generate and store event ID if event store is provided
      let eventId: string | undefined
      if (this.#eventStore) {
        // Stores the event and gets the generated event ID
        eventId = await this.#eventStore.storeEvent(this.#standaloneSseStreamId, message)
      }

      // Send the message to the standalone SSE stream
      return standaloneSse.stream?.writeSSE({
        id: eventId,
        event: 'message',
        data: JSON.stringify(message),
      })
    }

    // Get the response for this request
    const streamId = this.#requestToStreamMapping.get(requestId)
    const response = this.#streamMapping.get(streamId!)
    if (!streamId) {
      throw new Error(`No connection established for request ID: ${String(requestId)}`)
    }

    if (!this.#enableJsonResponse) {
      // For SSE responses, generate event ID if event store is provided
      let eventId: string | undefined

      if (this.#eventStore) {
        eventId = await this.#eventStore.storeEvent(streamId, message)
      }

      if (response) {
        // Write the event to the response stream
        await response.stream?.writeSSE({
          id: eventId,
          event: 'message',
          data: JSON.stringify(message),
        })
      }
    }

    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      this.#requestResponseMap.set(requestId, message)
      const relatedIds = Array.from(this.#requestToStreamMapping.entries())
        .filter(([, streamId]) => this.#streamMapping.get(streamId) === response)
        .map(([id]) => id)

      // Check if we have responses for all requests using this connection
      const allResponsesReady = relatedIds.every((id) => this.#requestResponseMap.has(id))

      if (allResponsesReady) {
        if (!response) {
          throw new Error(`No connection established for request ID: ${String(requestId)}`)
        }
        if (this.#enableJsonResponse) {
          // All responses ready, send as JSON
          if (this.sessionId !== undefined) {
            response.ctx.header('mcp-session-id', this.sessionId)
          }

          const responses = relatedIds.map((id) => this.#requestResponseMap.get(id)!)

          response.ctx.json(responses.length === 1 ? responses[0] : responses)
          return
        } else {
          response.stream?.close()
        }
        // Clean up
        for (const id of relatedIds) {
          this.#requestResponseMap.delete(id)
          this.#requestToStreamMapping.delete(id)
        }
      }
    }
  }
}
