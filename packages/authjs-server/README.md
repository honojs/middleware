# Auth.js Server Middleware for Hono

Auth.js Server Middleware adapts [Auth.js](https://authjs.dev/) server as middleware for Hono.

## Usage

```ts
import { authjsServer } from '@hono/auth-js-server'
import { Hono } from 'hono'

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

export default app
```

## Testing

Copy the example .env file and populate it with credentials from GitHub

```
cp .env.examaple .env
```

## Author

Ivo Ilić <https://github.com/ivoilic>

Based on the [Auth.js frameworks-solid-start package](https://github.com/nextauthjs/next-auth/tree/main/packages/frameworks-solid-start) by [OrJDev](https://github.com/OrJDev)

## License

MIT
