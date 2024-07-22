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

  const app = new Hono()
  app.use(brief(app))

  app.get('/route1', (c) => c.text('route1'))
  app.get('/route2', (c) => c.text('route2'))
  app.get('/route1', (c) => c.text('route')) // duplicated route

  const response = await app.request('http://localhost/route1')
  expect(response).toBeDefined()
})

afterEach(() => {
  console.info = originalConsoleInfo
  console.table = originalConsoleTable
})

describe('Brief middleware', () => {
  it('Should log title', async () => {
    expect(consoleInfoMock).toHaveBeenCalledWith(expect.stringContaining('[INFO] APP ROUTES:'))
  })

  it('Should log table without duplicating and ALL method', async () => {
    expect(consoleTableMock).toHaveBeenCalledWith([
      { path: '/route1', method: 'GET' },
      { path: '/route2', method: 'GET' },
    ])
  })
})
