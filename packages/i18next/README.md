# i18next middleware for Hono

## Installation

```bash
bun add @hono/i18next i18next
# or
npm install @hono/i18next i18next
# or
yarn add @hono/i18next i18next
```

## Usage

```ts
import { useI18next, type I18nextMiddlewareOptions } from '@hono/i18next'
import { Hono } from 'hono'

const app = new Hono()

const options: I18nextMiddlewareOptions = {
  headerName: 'X-Localization',
  // if true, it will set the language in the i18next instance
  setLanguageChanges: false,
  // i18next options:
  fallbackLng: 'en',
  returnNull: false,
  nsSeparator: '.',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: { hello: 'Hello!' } },
    tr: { translation: { hello: 'Merhaba!' } },
  },
}

app.use('*', useI18next(options))

app.get('/hello', (c) => {
  const t = c.get('t')
  return c.json({ message: t('hello') })
})

export default app
```

## Author

Onur Ozkaya <https://github.com/nrzky>

## License

MIT
