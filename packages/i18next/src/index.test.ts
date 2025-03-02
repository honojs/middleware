import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { useI18next } from '../src'
import type { I18nextMiddlewareOptions } from '../src'

describe('i18next middleware', () => {
  const en = { hello: 'Hello!', errMsg: 'Opps!' }
  const tr = { hello: 'Merhaba!', errMsg: 'Hay Aksi!' }

  const fallbackLng = 'en'

  const requestHeaderName = 'X-Localization'

  const options: I18nextMiddlewareOptions = {
    headerName: requestHeaderName,
    setLanguageChanges: false,
    fallbackLng: fallbackLng,
    returnNull: false,
    nsSeparator: '.',
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, tr: { translation: tr } },
  }

  const app = new Hono()

  app.use('*', useI18next(options))

  app.get('/hello', (c) => {
    const t = c.get('t')
    return c.json({ message: t('hello') })
  })

  app.get('/error', (c) => {
    const t = c.get('t')
    throw new HTTPException(400, { message: t('errMsg') })
  })

  app.onError((err, c) => {
    return c.json({ message: err.message }, err instanceof HTTPException ? err.status : 500)
  })

  it('Should return hello message in English', async () => {
    const res = await app.request('http://localhost/hello', {
      headers: { [requestHeaderName]: 'en' },
    })

    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: en.hello })
  })

  it('Should return hello message in Turkish', async () => {
    const res = await app.request('http://localhost/hello', {
      headers: { [requestHeaderName]: 'tr' },
    })

    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: tr.hello })
  })

  it('Should return hello message in fallback language when language not supported', async () => {
    const res = await app.request('http://localhost/hello', {
      headers: { [requestHeaderName]: 'fr' },
    })

    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: en.hello })
  })

  it('Should return hello message in fallback language when language is undefined', async () => {
    const res = await app.request('http://localhost/hello')

    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: en.hello })
  })

  it('Should return error message in English', async () => {
    const res = await app.request('http://localhost/error', {
      headers: { [requestHeaderName]: 'en' },
    })

    expect(res).not.toBeNull()
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ message: en.errMsg })
  })
})
