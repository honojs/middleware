# Session middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=session)](https://codecov.io/github/honojs/middleware)

Session middleware for Hono using encrypted JSON Web Tokens.

This middleware depends on [`jose`](https://github.com/panva/jose) for JSON Web Encryption.

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

| Option          | Type                                                                | Description                                                                                                               |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `generateId`?   | `() => string`                                                      | Function to generate a unique session ID                                                                                  |
| `secret`?       | `string` \| [`EncryptionKey`](#EncryptionKey)                       | 32-byte, hex-encoded string, or encryption key, used to encrypt the session cookie. Defaults to `process.env.AUTH_SECRET` |
| `duration`?     | [`MaxAgeDuration`](#MaxAgeDuration)                                 | The maximum age duration of the session cookie. By default, no maximum age is set                                         |
| `deleteCookie`? | [`DeleteCookie`](https://hono.dev/docs/helpers/cookie#deletecookie) | Defaults to `hono/cookie#deleteCookie`                                                                                    |
| `getCookie`?    | [`GetCookie`](https://hono.dev/docs/helpers/cookie)                 | Defaults to `hono/cookie#getCookie`                                                                                       |
| `setCookie`?    | [`SetCookie`](https://hono.dev/docs/helpers/cookie)                 | Defaults to `hono/cookie#setCookie`                                                                                       |

## `EncryptionKey`

- [`jose.CryptoKey`](https://github.com/panva/jose/blob/main/docs/types/type-aliases/CryptoKey.md) | [`jose.KeyObject`](https://github.com/panva/jose/blob/main/docs/types/interfaces/KeyObject.md) | [`jose.JWK`](https://github.com/panva/jose/blob/main/docs/types/interfaces/JWK.md) | [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

## `MaxAgeDuration`

See [Session lifetime](https://thecopenhagenbook.com/sessions#session-lifetime)

> [!IMPORTANT]
> By default, session cookies do not expire.
> It is recommended to provide value for `duration.absolute`

### Properties

| Property      | Type     | Description                                                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `absolute`    | `number` | Duration in seconds a session will be valid for, after which it will be expired and have to be re-authenticated. |
| `inactivity`? | `number` | Duration in seconds a session will be considered active, during which the session max age can be extended.       |

## `Session<Data>`

### Properties

| Property        | Type             | Description           |
| --------------- | ---------------- | --------------------- |
| readonly `data` | `Data` \| `null` | Current session data. |

### Methods

#### delete()

delete(): `void`

Delete the current session, removing the session cookie and data from storage.

#### Returns

`void`

### get()

get(`refresh`): `Promise`<`Data` | `null`>

Get the current session data, optionally calling the provided refresh function.

#### Parameters

| Parameter  | Type                            | Description                |
| ---------- | ------------------------------- | -------------------------- |
| `refresh`? | [`Refresh<Data>`](#refreshdata) | Optional refresh function. |

### Returns

`Promise`<`Data` | `null`>

## `Refresh<Data>`

refresh(`expired`) => `Promise`<`Data` | `null`>

Function to refresh the session data. If the refresh function returns null, the session will be destroyed.

#### Parameters

| Parameter | Type             | Description         |
| --------- | ---------------- | ------------------- |
| `expired` | `Data` \| `null` | Expire session data |

#### Returns

`Data` | `null`

### update()

update(`data`): `Promise`<`void`>

Update the current session with the provided session data.

#### Parameters

| Parameter | Type                                    | Description                         |
| --------- | --------------------------------------- | ----------------------------------- |
| `data`    | `Data` \| [`Update<Data>`](#updatedata) | New data or function to update data |

#### Returns

`Promise`<`void`>

## `Update<Data>`

update(`prevData`) => `Data`

Function to update previous session data.

#### Parameters

| Parameter  | Type             | Description           |
| ---------- | ---------------- | --------------------- |
| `prevData` | `Data` \| `null` | Previous session data |

#### Returns

`Data`

## Example

```ts
import { useSession } from '@hono/session'
import { Hono } from 'hono'

const app = new Hono()

app.use(useSession()).get('/', async (c) => {
  const data = await c.var.session.get()
  return c.json(data)
})

export default app
```

### With Session storage

```ts
import { useSession, useSessionStorage } from '@hono/session'
import type { SessionEnv } from '@hono/session'
import { Hono } from 'hono'

const app = new Hono<SessionEnv>()

app.use(
  useSessionStorage({
    delete(sid) {},
    async get(sid) {},
    set(sid, value) {},
  }),
  useSession()
)

app.get('/', async (c) => {
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
