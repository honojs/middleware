import { serve } from '@hono/node-server'
import type { ServerType } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { WSMessageReceive } from 'hono/ws'
import { connect } from 'node:net'
import { WebSocket } from 'ws'
import { createNodeWebSocket } from '.'

describe('WebSocket helper', () => {
  let app: Hono
  let server: ServerType
  let injectWebSocket: ReturnType<typeof createNodeWebSocket>['injectWebSocket']
  let upgradeWebSocket: ReturnType<typeof createNodeWebSocket>['upgradeWebSocket']
  let wss: ReturnType<typeof createNodeWebSocket>['wss']

  beforeEach(async () => {
    app = new Hono()
    ;({ injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app }))

    server = await new Promise<ServerType>((resolve) => {
      const server = serve({ fetch: app.fetch, port: 3030 }, () => {
        resolve(server)
      })
    })
    injectWebSocket(server)
  })

  afterEach(() => {
    server.close()
  })

  it('Should be inited WebSocket Context even if upgrading process is asynchronous', async () => {
    const mainPromise = new Promise<boolean>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(
          () =>
            new Promise((resolveWS) =>
              setTimeout(() => {
                resolveWS({
                  onOpen() {
                    resolve(true)
                  },
                })
              }, 100)
            )
        )
      )
    )

    new WebSocket('ws://localhost:3030/')

    expect(await mainPromise).toBe(true)
  })

  it('Should be rejected if upgradeWebSocket is not used', async () => {
    app.get('/', (c) => c.body(''))

    {
      const ws = new WebSocket('ws://localhost:3030/')
      const mainPromise = new Promise<boolean>((resolve) => {
        ws.onerror = () => {
          resolve(true)
        }
        ws.onopen = () => {
          resolve(false)
        }
      })

      expect(await mainPromise).toBe(true)
    }

    {
      //also should rejected on fallback
      const ws = new WebSocket('ws://localhost:3030/notFound')
      const mainPromise = new Promise<boolean>((resolve) => {
        ws.onerror = () => {
          resolve(true)
        }
        ws.onopen = () => {
          resolve(false)
        }
      })

      expect(await mainPromise).toBe(true)
    }
  })

  it('Should be able to connect', async () => {
    const mainPromise = new Promise<boolean>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onOpen() {
            resolve(true)
          },
        }))
      )
    )

    new WebSocket('ws://localhost:3030/')

    expect(await mainPromise).toBe(true)
  })

  it('Should be able to send and receive messages', async () => {
    const mainPromise = new Promise((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onMessage(data) {
            resolve(data.data)
          },
        }))
      )
    )

    const ws = new WebSocket('ws://localhost:3030/')
    await new Promise<void>((resolve) => ws.on('open', resolve))
    ws.send('Hello')

    expect(await mainPromise).toBe('Hello')
  })

  it('Should handle multiple concurrent connections', async () => {
    const connectionCount = 5
    let openConnections = 0
    const messages: string[] = []

    app.get(
      '/',
      upgradeWebSocket(() => ({
        onOpen() {
          openConnections++
        },
        onMessage(data, ws) {
          messages.push(data.data as string)
          ws.send(data.data as string)
        },
      }))
    )

    const connections = await Promise.all(
      Array(connectionCount)
        .fill(null)
        .map(async () => {
          const ws = new WebSocket('ws://localhost:3030/')
          await new Promise<void>((resolve) => ws.on('open', resolve))
          return ws
        })
    )

    expect(openConnections).toBe(connectionCount)

    await Promise.all(
      connections.map((ws, index) => {
        return new Promise<void>((resolve) => {
          ws.send(`Hello from connection ${index + 1}`)
          ws.on('message', () => {
            resolve()
          })
        })
      })
    )

    expect(messages.length).toBe(connectionCount)
    messages.forEach((msg, index) => {
      expect(msg).toBe(`Hello from connection ${index + 1}`)
    })

    connections.forEach((ws) => {
      ws.close()
    })
  })

  it('CloseEvent should be executed without crash', async () => {
    const testCode = 3001
    const testReason = 'Test!'
    app.get(
      '/',
      upgradeWebSocket(() => ({
        onClose(event) {
          expect(event.code).toBe(testCode)
          expect(event.reason).toBe(testReason)
        },
      }))
    )

    const ws = new WebSocket('ws://localhost:3030/')
    await new Promise<void>((resolve) => ws.on('open', resolve))
    ws.close(testCode, testReason)
  })

  it('Should be able to send and receive binary content with good length', async () => {
    const mainPromise = new Promise<WSMessageReceive>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onMessage(data) {
            resolve(data.data)
          },
        }))
      )
    )

    const binaryData = new Uint8Array(Array.from({ length: 16 }).map((_, i) => i ** 2))

    const ws = new WebSocket('ws://localhost:3030/')
    await new Promise<void>((resolve) => ws.on('open', resolve))
    ws.send(binaryData)

    const receivedMessage = await mainPromise
    expect(receivedMessage).toBeInstanceOf(ArrayBuffer)
    expect((receivedMessage as ArrayBuffer).byteLength).toBe(binaryData.length)

    binaryData.forEach((val, idx) => {
      expect(new Uint8Array(receivedMessage as ArrayBuffer)[idx]).toBe(val)
    })
  })

  describe('Types', () => {
    it('Should not throw a type error with an app with Variables generics', () => {
      const app = new Hono<{
        Variables: {
          foo: string
        }
      }>()
      createNodeWebSocket({ app })
    })
  })

  it('Should client can connect when use cors()', async () => {
    app.use(cors())
    const mainPromise = new Promise<boolean>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onOpen() {
            resolve(true)
          },
        }))
      )
    )

    new WebSocket('ws://localhost:3030/')

    expect(await mainPromise).toBe(true)
  })
  it('Should client can connect even if a response has difference', async () => {
    app.use(async (c, next) => {
      c.res = new Response(null, c.res)
      await next()
    })
    const mainPromise = new Promise<boolean>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(() => ({
          onOpen() {
            resolve(true)
          },
        }))
      )
    )

    new WebSocket('ws://localhost:3030/')

    expect(await mainPromise).toBe(true)
  })

  it('Should not async processes to create events affect message handling', async () => {
    const mainPromise = new Promise<boolean>((resolve) =>
      app.get(
        '/',
        upgradeWebSocket(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return {
            onMessage() {
              resolve(true)
            },
          }
        })
      )
    )

    const ws = new WebSocket('ws://localhost:3030/')
    ws.onopen = () => {
      ws.send('Hello')
    }

    expect(await mainPromise).toBe(true)
  })

  it('Should return the wss used for the websocket helper', async () => {
    let clientWs: WebSocket | null = null
    const mainPromise = new Promise<void>((resolve) =>
      wss.on('connection', (ws) => {
        clientWs = ws
        resolve()
      })
    )

    app.get(
      '/',
      upgradeWebSocket(() => ({}))
    )
    new WebSocket('ws://localhost:3030/')

    await mainPromise

    expect(clientWs).toBeTruthy()
    expect(wss.clients.size).toBe(1)
  })

  it('Should allow for custom HTTPException status code', async () => {
    app.get(
      '/',
      upgradeWebSocket(() => {
        throw new HTTPException(401)
      })
    )
    const ws = new WebSocket('ws://localhost:3030/')
    await new Promise<void>((resolve) =>
      ws.on('unexpected-response', (_, response) => {
        expect(response.statusCode).toEqual(401)
        resolve()
      })
    )
  })
  describe('Upgrade request hardening', () => {
    const upgradeHeaders = (upgrade = 'websocket') =>
      'Host: localhost:3030\r\n' +
      `Upgrade: ${upgrade}\r\n` +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Version: 13\r\n' +
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n'

    const requestUpgrade = (target: string, upgrade?: string) =>
      new Promise<string>((resolve, reject) => {
        const socket = connect(3030, 'localhost', () => {
          socket.write(`GET ${target} HTTP/1.1\r\n${upgradeHeaders(upgrade)}\r\n`)
        })
        let response = ''
        socket.on('data', (chunk) => {
          response += chunk.toString('utf-8')
          if (response.includes('\r\n\r\n')) {
            socket.destroy()
            resolve(response.split('\r\n')[0] ?? '')
          }
        })
        socket.once('error', reject)
        socket.once('close', () => reject(new Error('Socket closed before receiving a response')))
        socket.setTimeout(1_000, () => socket.destroy(new Error('upgrade timed out')))
      })

    const connectClient = async (url = 'ws://localhost:3030/ws') => {
      const ws = new WebSocket(url)
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve())
        ws.on('error', reject)
      })
      ws.close()
    }

    it('Should not crash on a request-target that is not a valid URL', async () => {
      const seenUrls: string[] = []
      app.get(
        '*',
        upgradeWebSocket((c) => {
          seenUrls.push(c.req.url)
          return {}
        })
      )

      expect(await requestUpgrade('//[')).toBe('HTTP/1.1 101 Switching Protocols')
      expect(seenUrls).toEqual(['http://localhost:3030//['])
      await connectClient()
    })

    it.each([
      '/admin\\secret',
      '/public\\..\\admin/secret',
      '/public\\%2e%2e\\admin/secret',
      '/admin\\secret?next=public',
      'http://localhost:3030/admin\\secret',
    ])('Should return 400 before calling the app for %s', async (target) => {
      let called = false
      app.get(
        '*',
        upgradeWebSocket(() => {
          called = true
          return {}
        })
      )

      expect(await requestUpgrade(target)).toBe('HTTP/1.1 400 Bad Request')
      expect(called).toBe(false)
    })

    it('Should keep the host from the Host header for a request-target starting with //', async () => {
      const seenUrls: string[] = []
      app.get(
        '*',
        upgradeWebSocket((c) => {
          seenUrls.push(c.req.url)
          return {}
        })
      )

      expect(await requestUpgrade('//attacker.example/ws')).toBe('HTTP/1.1 101 Switching Protocols')
      expect(seenUrls).toEqual(['http://localhost:3030//attacker.example/ws'])
    })

    it('Should accept an absolute-form request-target', async () => {
      const seenUrls: string[] = []
      app.get(
        '/ws',
        upgradeWebSocket((c) => {
          seenUrls.push(c.req.url)
          return {}
        })
      )

      expect(await requestUpgrade('http://localhost:3030/ws')).toBe(
        'HTTP/1.1 101 Switching Protocols'
      )
      expect(seenUrls).toEqual(['http://localhost:3030/ws'])
    })

    it('Should reject a request-target that does not start with /', async () => {
      app.get(
        '/ws',
        upgradeWebSocket(() => ({}))
      )

      expect(await requestUpgrade('ws')).toBe('HTTP/1.1 400 Bad Request')
    })

    it('Should use baseUrl as the origin when given', async () => {
      const app = new Hono()
      const seenUrls: string[] = []
      const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
        app,
        baseUrl: 'https://example.com/ignored',
      })
      app.get(
        '*',
        upgradeWebSocket((c) => {
          seenUrls.push(c.req.url)
          return {}
        })
      )
      const server = await new Promise<ServerType>((resolve) => {
        const server = serve({ fetch: app.fetch, port: 3031 }, () => resolve(server))
      })
      injectWebSocket(server)

      try {
        await connectClient('ws://localhost:3031//attacker.example/ws')
        expect(seenUrls).toEqual(['https://example.com//attacker.example/ws'])
      } finally {
        server.close()
      }
    })

    it('Should reject an upgrade request for another protocol', async () => {
      let called = false
      app.get('*', (c) => {
        called = true
        return c.text('ok')
      })

      expect(await requestUpgrade('/', 'h2c')).toBe('HTTP/1.1 400 Bad Request')
      expect(called).toBe(false)
    })

    it.each([
      ['a TCP reset', (socket: ReturnType<typeof connect>) => socket.resetAndDestroy()],
      ['a graceful close', (socket: ReturnType<typeof connect>) => socket.destroy()],
    ])('Should survive %s while the app is still running', async (_name, end) => {
      let handled = 0
      app.use('/ws', async (_c, next) => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await next()
      })
      app.get(
        '/ws',
        upgradeWebSocket(() => ({
          onOpen() {
            handled++
          },
        }))
      )

      await new Promise<void>((resolve) => {
        const socket = connect(3030, 'localhost', () => {
          socket.write(`GET /ws HTTP/1.1\r\n${upgradeHeaders()}\r\n`, () => end(socket))
        })
        socket.on('error', () => {})
        socket.on('close', () => resolve())
      })
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(handled).toBe(0)

      await connectClient()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(handled).toBe(1)
    })
  })
})
