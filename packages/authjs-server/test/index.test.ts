import GitHub from '@auth/core/providers/github'
import { Hono } from 'hono'
import { authjsServer, type HonoAuthConfig } from '../src'

describe('Auth.js Adapter Middleware', () => {
  const app = new Hono()

  const authOpts: HonoAuthConfig = {
    providers: [
      //@ts-expect-error issue https://github.com/nextauthjs/next-auth/issues/6174
      GitHub({
        clientId: process.env.GITHUB_ID as string,
        clientSecret: process.env.GITHUB_SECRET as string,
      }),
    ],
    debug: true,
  }

  app.use('/auth/*', authjsServer(authOpts))

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/auth/error')
    const res = await app.request(req)
    expect(res.status).toBe(200)
  })
})
