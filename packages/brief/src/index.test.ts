import { vi } from 'vitest'
import { Hono } from 'hono'
import { brief } from '../src'

const originalConsoleInfo = console.info
const originalConsoleTable = console.table
const consoleInfoMock = vi.fn()
const consoleTableMock = vi.fn()

beforeEach(async () => {
  console.info = consoleInfoMock
  console.table = consoleTableMock
  consoleInfoMock.mockClear()
  consoleTableMock.mockClear()
})

afterEach(() => {
  console.info = originalConsoleInfo
  console.table = originalConsoleTable
})

describe('Brief middleware', () => {
  it('Should log default title', async () => {
    const app = new Hono()
    app.use('*', brief(app))

    await app.request('http://localhost')
    expect(consoleInfoMock).toHaveBeenCalledWith(expect.stringContaining('[INFO] APP ROUTES:'))
  })

  it('Should log custom title', async () => {
    const app = new Hono()
    app.use('*', brief(app, '[INFO] CUSTOM TITLE'))

    await app.request('http://localhost')
    expect(consoleInfoMock).toHaveBeenCalledWith(expect.stringContaining('[INFO] CUSTOM TITLE:'))
  })

  it('Should log table without duplicating and ALL method', async () => {
    const app = new Hono()
    app.use('*', brief(app))

    app.get('/route1', (c) => c.text('route1'))
    app.get('/route2', (c) => c.text('route2'))
    app.get('/route1', (c) => c.text('route')) // duplicated route

    await app.request('http://localhost')
    expect(consoleTableMock).toHaveBeenCalledWith([
      { path: '/route1', method: 'GET' },
      { path: '/route2', method: 'GET' },
    ])
  })
})
