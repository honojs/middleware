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
  isInitializeRequest,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCMessageSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js'

// Fallback constant if not available in current SDK version
const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { SSEStreamingApi } from 'hono/streaming'
import { streamSSE } from './streaming'

/**
 * Simple in-memory implementation of EventStore for resumability
 */
class MemoryEventStore implements EventStore {
  private events = new Map<string, { id: string; message: JSONRPCMessage }[]>()
  private eventCounter = 0

  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = (++this.eventCounter).toString()

    if (!this.events.has(streamId)) {
      this.events.set(streamId, [])
    }

    this.events.get(streamId)!.push({ id: eventId, message })

    // Keep only last 1000 events per stream to prevent memory leak
    const streamEvents = this.events.get(streamId)!
    if (streamEvents.length > 1000) {
      streamEvents.splice(0, streamEvents.length - 1000)
    }

    return eventId
  }

  async replayEventsAfter(
    lastEventId: string,
    sender: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> }
  ): Promise<string> {
    const streamId = this.findStreamByEventId(lastEventId)
    if (!streamId || !this.events.has(streamId)) {
      return streamId || '_unknown_stream'
    }

    const streamEvents = this.events.get(streamId)!
    const lastEventIndex = streamEvents.findIndex((event) => event.id === lastEventId)

    if (lastEventIndex === -1) {
      // Event not found, replay all events
      for (const event of streamEvents) {
        await sender.send(event.id, event.message)
      }
    } else {
      // Replay events after the specified event ID
      for (const event of streamEvents.slice(lastEventIndex + 1)) {
        await sender.send(event.id, event.message)
      }
    }

    return streamId
  }

  private findStreamByEventId(eventId: string): string | undefined {
    for (const [streamId, events] of this.events.entries()) {
      if (events.some((event) => event.id === eventId)) {
        return streamId
      }
    }
    return undefined
  }

  clearStream(streamId: string): void {
    this.events.delete(streamId)
  }
}

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
      writeQueue?: Promise<void>
      queueCount: number
      writing: boolean
      cleaned: boolean
    }
  >()
  #requestToStreamMapping = new Map<RequestId, string>()
  #requestResponseMap = new Map<RequestId, JSONRPCMessage>()
  #allowedHosts?: string[]
  #allowedOrigins?: string[]
  #enableDnsRebindingProtection: boolean
  #maxQueueSize: number
  #maxMessageSize: number

  sessionId?: string
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void

  constructor(
    options?: StreamableHTTPServerTransportOptions & {
      maxQueueSize?: number
      maxMessageSize?: number
      onsessionclosed?: (sessionId: string) => void
      allowedHosts?: string[]
      allowedOrigins?: string[]
      enableDnsRebindingProtection?: boolean
    }
  ) {
    this.#sessionIdGenerator = options?.sessionIdGenerator
    this.#enableJsonResponse = options?.enableJsonResponse ?? false
    this.#eventStore = options?.eventStore ?? new MemoryEventStore()
    this.#onSessionInitialized = options?.onsessioninitialized
    this.#onSessionClosed = options?.onsessionclosed
    this.#allowedHosts = options?.allowedHosts
    this.#allowedOrigins = options?.allowedOrigins
    this.#enableDnsRebindingProtection = options?.enableDnsRebindingProtection ?? false
    this.#maxQueueSize = options?.maxQueueSize ?? 100
    this.#maxMessageSize = options?.maxMessageSize ?? 1024 * 1024 // 1MB
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
   * Writes an SSE event with proper formatting (unified method like official SDK)
   */
  #writeSSEEvent(
    stream: SSEStreamingApi,
    message: JSONRPCMessage,
    eventId?: string
  ): Promise<void> {
    return stream.writeSSE({
      id: eventId,
      event: 'message',
      data: JSON.stringify(message),
    })
  }

  /**
   * Queues SSE writes to prevent concurrent write issues
   */
  async #queueWrite(streamId: string, writeFn: () => Promise<void>): Promise<void> {
    const streamEntry = this.#streamMapping.get(streamId)
    if (!streamEntry) {
      throw new Error(`Stream ${streamId} not found`)
    }

    // Check queue size limit
    if (streamEntry.queueCount >= this.#maxQueueSize) {
      throw new Error(`Queue size limit exceeded for stream ${streamId}`)
    }

    // Prevent reentrancy - if already writing, wait for current write to complete
    if (streamEntry.writing) {
      console.debug(`[SSE] Write already in progress for stream ${streamId}, queueing`)
    }

    streamEntry.queueCount = (streamEntry.queueCount || 0) + 1

    const currentWrite = streamEntry.writeQueue || Promise.resolve()
    const startTime = Date.now()

    const newWrite = currentWrite
      .then(async () => {
        // Set writing flag to prevent reentrancy
        const entry = this.#streamMapping.get(streamId)
        if (entry) {
          entry.writing = true
        }

        console.debug(`[SSE] Starting write for stream ${streamId}`)
        await writeFn()
        console.debug(`[SSE] Completed write for stream ${streamId} in ${Date.now() - startTime}ms`)
      })
      .catch((error) => {
        console.error(`[SSE] Write error for stream ${streamId}:`, error)
        this.onerror?.(error as Error)
      })
      .finally(() => {
        // Clean up completed write if it's the current one
        const currentEntry = this.#streamMapping.get(streamId)
        if (currentEntry) {
          currentEntry.writing = false
          currentEntry.queueCount = Math.max(0, (currentEntry.queueCount || 0) - 1)
          if (currentEntry.writeQueue === newWrite) {
            delete currentEntry.writeQueue
          }
        }
      })

    streamEntry.writeQueue = newWrite
    await newWrite
  }

  /**
   * Normalizes a host header value for comparison (simplified version based on official SDK)
   */
  #normalizeHost(host: string | undefined): string | undefined {
    if (!host) {
      return undefined
    }
    return host.trim().toLowerCase()
  }

  /**
   * Validates request headers for DNS rebinding protection (simplified based on official SDK).
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
      if (!hostHeader || !this.#allowedHosts.includes(hostHeader)) {
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
          streamId = async (stream) => {
            try {
              const resolvedStreamId = await this.#eventStore!.replayEventsAfter(lastEventId, {
                send: async (eventId: string, message: JSONRPCMessage) => {
                  await this.#writeSSEEvent(stream, message, eventId)
                },
              })
              return resolvedStreamId
            } catch (error) {
              this.onerror?.(new Error('Failed replay events'))
              throw new HTTPException(500, {
                message: 'Failed replay events',
              })
            }
          }
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
          queueCount: 0,
          writing: false,
          cleaned: false,
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
          const entry = this.#streamMapping.get(resolvedStreamId)
          if (entry && !entry.cleaned) {
            entry.cleaned = true
            this.#streamMapping.delete(resolvedStreamId)
            // Clear EventStore for this stream
            if (this.#eventStore instanceof MemoryEventStore) {
              this.#eventStore.clearStream(resolvedStreamId)
            }
          }
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
        const bodyText = await ctx.req.text()

        // Check message size limit (using TextEncoder for accurate multi-byte character measurement)
        const bodyBytes = new TextEncoder().encode(bodyText).length
        if (bodyBytes > this.#maxMessageSize) {
          throw new HTTPException(413, {
            res: Response.json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Request entity too large',
              },
              id: null,
            }),
          })
        }

        try {
          rawMessage = JSON.parse(bodyText)
        } catch (error) {
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
                    json: resolve as (data: unknown) => void,
                  },
                  queueCount: 0,
                  writing: false,
                  cleaned: false,
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
                queueCount: 0,
                writing: false,
                cleaned: false,
              })
              this.#requestToStreamMapping.set(message.id, streamId)
            }
          }

          // Set up close handler for client disconnects
          stream.onAbort(() => {
            const entry = this.#streamMapping.get(streamId)
            if (entry && !entry.cleaned) {
              entry.cleaned = true
              this.#streamMapping.delete(streamId)
              // Clean up request mappings for this stream
              const relatedIds = Array.from(this.#requestToStreamMapping.entries())
                .filter(([, sid]) => sid === streamId)
                .map(([id]) => id)

              for (const id of relatedIds) {
                this.#requestToStreamMapping.delete(id)
                this.#requestResponseMap.delete(id)
              }
            }
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
      throw new HTTPException(400, {
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

  /**
   * Gets debug information about the transport state (for testing purposes)
   */
  getDebugInfo(): {
    hasEventStore: boolean
    streamCount: number
    requestMappingCount: number
    responseMapCount: number
    writeQueueCount: number
    initialized: boolean
    sessionId?: string
  } {
    const writeQueueCount = Array.from(this.#streamMapping.values()).filter(
      (entry) => entry.writeQueue
    ).length

    return {
      hasEventStore: !!this.#eventStore,
      streamCount: this.#streamMapping.size,
      requestMappingCount: this.#requestToStreamMapping.size,
      responseMapCount: this.#requestResponseMap.size,
      writeQueueCount,
      initialized: this.#initialized,
      sessionId: this.sessionId,
    }
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

      // Queue the write to prevent concurrent write issues
      return this.#queueWrite(this.#standaloneSseStreamId, async () => {
        // Generate and store event ID if event store is provided
        let eventId: string | undefined
        if (this.#eventStore) {
          // Stores the event and gets the generated event ID
          eventId = await this.#eventStore.storeEvent(this.#standaloneSseStreamId, message)
        }

        // Send the message to the standalone SSE stream
        if (standaloneSse.stream?.closed) {
          console.debug(`[SSE] Stream ${this.#standaloneSseStreamId} is closed, skipping write`)
          return
        }

        console.debug(
          `[SSE] Writing to stream ${this.#standaloneSseStreamId}:`,
          JSON.stringify(message)
        )
        await this.#writeSSEEvent(standaloneSse.stream!, message, eventId)
        console.debug(`[SSE] Successfully wrote to stream ${this.#standaloneSseStreamId}`)
      })
    }

    // Get the response for this request
    const streamId = this.#requestToStreamMapping.get(requestId)
    const response = this.#streamMapping.get(streamId!)
    if (!streamId) {
      throw new Error(`No connection established for request ID: ${String(requestId)}`)
    }

    if (!this.#enableJsonResponse) {
      if (response) {
        // Queue the write to prevent concurrent write issues
        await this.#queueWrite(streamId, async () => {
          // For SSE responses, generate event ID if event store is provided
          let eventId: string | undefined

          if (this.#eventStore) {
            eventId = await this.#eventStore.storeEvent(streamId, message)
          }

          // Write the event to the response stream
          if (response.stream && !response.stream.closed) {
            await this.#writeSSEEvent(response.stream, message, eventId)
          }
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
