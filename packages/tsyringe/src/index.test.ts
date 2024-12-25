import 'reflect-metadata'
import { Hono } from 'hono'
import { injectable, inject } from 'tsyringe'
import { tsyringe } from '../src'

class Config {
  constructor(public readonly tenantName: string) {}
}

@injectable()
class TenantService {
  constructor(@inject(Config) public readonly config: Config) {}

  get message() {
    return `Hello, ${this.config.tenantName}!`
  }
}

describe('tsyringe middleware', () => {
  const app = new Hono()

  app.use(
    '/hello/*',
    tsyringe((container) => container.register('foo', { useValue: 'Hello!' }))
  )
  app.get('/hello/foo', (c) => {
    const message = c.var.resolve<string>('foo')
    return c.text(message)
  })

  app.use('/tenant/:name/*', async (c, next) => {
    await tsyringe((container) => {
      const tenantName = c.req.param('name')

      container.register(Config, { useFactory: () => new Config(tenantName) })
    })(c, next)
  })

  app.get('/tenant/:name/message', (c) => {
    const tenantService = c.var.resolve(TenantService)
    return c.text(tenantService.message)
  })

  it('Should be hello message', async () => {
    const res = await app.request('http://localhost/hello/foo')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello!')
  })

  it('Should be tenant message', async () => {
    const res = await app.request('http://localhost/tenant/foo/message')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello, foo!')
  })
})
