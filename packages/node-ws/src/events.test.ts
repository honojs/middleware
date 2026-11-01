describe('ErrorEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('Should fall back to a polyfill when globalThis.ErrorEvent is not defined', async () => {
    vi.stubGlobal('ErrorEvent', undefined)
    vi.resetModules()
    const { ErrorEvent } = await import('./events')

    const error = new Error('boom')
    const event = new ErrorEvent('error', { error, message: 'boom', filename: 'a.js', lineno: 1, colno: 2 })

    expect(event).toBeInstanceOf(Event)
    expect(event.type).toBe('error')
    expect(event.error).toBe(error)
    expect(event.message).toBe('boom')
    expect(event.filename).toBe('a.js')
    expect(event.lineno).toBe(1)
    expect(event.colno).toBe(2)
  })

  it('Should default the optional properties of the polyfill', async () => {
    vi.stubGlobal('ErrorEvent', undefined)
    vi.resetModules()
    const { ErrorEvent } = await import('./events')

    const event = new ErrorEvent('error')

    expect(event.error).toBeUndefined()
    expect(event.message).toBe('')
    expect(event.filename).toBe('')
    expect(event.lineno).toBe(0)
    expect(event.colno).toBe(0)
  })

  it.skipIf(typeof globalThis.ErrorEvent === 'undefined')(
    'Should use the native ErrorEvent when it is available',
    async () => {
    const native = globalThis.ErrorEvent
    vi.resetModules()
    const { ErrorEvent } = await import('./events')

    expect(ErrorEvent).toBe(native)
    }
  )
})
