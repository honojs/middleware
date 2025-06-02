# Session middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=session)](https://codecov.io/github/honojs/middleware)

Session middleware for Hono using encrypted JSON Web Tokens.

This middleware depends on the following pacakges:

- [`@panva/hkdf`](https://github.com/panva/hkdf)
- [`jose`](https://github.com/panva/jose)

Other resources worth reading include:

- [The Copenhagen Book](https://thecopenhagenbook.com/) by [Pilcrow](https://github.com/pilcrowOnPaper)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) from [OWASP](https://cheatsheetseries.owasp.org/index.html)

## Installation

```sh
npm i @hono/session
```

## Environment Variables

```sh
AUTH_SECRET=
```

> [!TIP]
> Quickly generate a good secret with `openssl`
>
> ```sh
> $ openssl rand -base64 32
> ```

## Options

| Option           | Type                                            | Description                                                                                                               |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `generateId`?    | `() => string`                                  | Function to generate a unique session ID                                                                                  |
| `secret`?        | `string` or [`EncryptionKey`](#EncryptionKey)   | 32-byte, hex-encoded string, or encryption key, used to encrypt the session cookie. Defaults to `process.env.AUTH_SECRET` |
| `sessionCookie`? | [`SessionCookieOptions`](#SessionCookieOptions) | Session cookie options                                                                                                    |

## `EncryptionKey`

- [`jose.CryptoKey`](https://github.com/panva/jose/blob/main/docs/types/type-aliases/CryptoKey.md) | [`jose.KeyObject`](https://github.com/panva/jose/blob/main/docs/types/interfaces/KeyObject.md) | [`jose.JWK`](https://github.com/panva/jose/blob/main/docs/types/interfaces/JWK.md) | [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

## `SessionCookieOptions`

> [!IMPORTANT]
> By default, session cookies do not expire.
> It is recommended to provide value for `duration.absolute`

### Properties

| Property    | Type                                                            | Description                                                                       |
| ----------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `duration`? | [`MaxAgeDuration`](#MaxAgeDuration)                             | The maximum age duration of the session cookie. By default, no maximum age is set |
| `name`?     | `string`                                                        | The name of the session cookie. Defaults to `sid`                                 |
| `options`?  | [`CookieOptions`](https://hono.dev/docs/helpers/cookie#options) | Session cookie options                                                            |

## `MaxAgeDuration`

See [Session lifetime](https://thecopenhagenbook.com/sessions#session-lifetime)

### Properties

| Property      | Type     | Description                                                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `absolute`    | `number` | Duration in seconds a session will be valid for, after which it will be expired and have to be re-authenticated. |
| `inactivity`? | `number` | Duration in seconds a session will be considered active, during which the session max age can be extended.       |

## Example

```ts
import { session } from '@hono/session'
import { Hono } from 'hono'

const app = new Hono()

app.use(session()).get('/', async (c) => {
  const data = await c.var.session.get()
  return c.json(data)
})

export default app
```

### With Session storage

```ts
import { session, sessionStorage } from '@hono/session'
import { Hono } from 'hono'

const app = new Hono()

app
  .use(
    sessionStorage({
      delete(sid) {},
      async get(sid) {},
      set(sid, value) {},
    }),
    session()
  )
  .get('/', async (c) => {
    const data = await c.var.session.get()
    return c.json(data)
  })

export default app
```

See also:

- [Cloudflare KV as session storage](./examples/cloudflare-kv.ts)
- [Using Unstorage as session storage](./examples/unstorage.ts)

## Author

Jonathan haines <https://github.com/barrythepenguin>

## License

MIT
