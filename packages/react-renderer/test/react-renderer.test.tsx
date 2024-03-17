import { Hono } from 'hono'

import { reactRenderer, useRequestContext } from '../src/react-renderer'

const RequestUrl = () => {
  const c = useRequestContext()
  return <>{c.req.url}</>
}

describe('Basic', () => {
  const app = new Hono()
  app.use(
    // @ts-expect-error - `title` is not defined
    reactRenderer(({ children, title }) => {
      return (
        <html>
          <head>{title}</head>
          <body>{children}</body>
        </html>
      )
    })
  )
  app.get('/', (c) => {
    return c.render(
      <h1>
        <RequestUrl />
      </h1>,
      {
        title: 'Title',
      }
    )
  })

  it('Should return HTML with layout', async () => {
    const res = await app.request('http://localhost/')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      '<html><head>Title</head><body><h1>http://localhost/</h1></body></html>'
    )
  })

  it('Should return HTML without layout', async () => {
    const app = new Hono()
    app.use('*', reactRenderer())
    app.get('/', (c) =>
      c.render(
        <h1>
          <RequestUrl />
        </h1>,
        { title: 'Title' }
      )
    )
    const res = await app.request('http://localhost/')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<h1>http://localhost/</h1>')
  })

  it('Should return a default doctype', async () => {
    const app = new Hono()
    app.use(
      '*',
      reactRenderer(
        ({ children }) => {
          return (
            <html>
              <body>{children}</body>
            </html>
          )
        },
        { docType: true }
      )
    )
    app.get('/', (c) => c.render(<h1>Hello</h1>, { title: 'Title' }))
    const res = await app.request('/')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<!DOCTYPE html><html><body><h1>Hello</h1></body></html>')
  })

  it('Should return a custom doctype', async () => {
    const app = new Hono()
    app.use(
      '*',
      reactRenderer(
        ({ children }) => {
          return (
            <html>
              <body>{children}</body>
            </html>
          )
        },
        {
          docType:
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">',
        }
      )
    )
    app.get('/', (c) => c.render(<h1>Hello</h1>, { title: 'Title' }))
    const res = await app.request('/')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html><body><h1>Hello</h1></body></html>'
    )
  })
})

describe('Streaming', () => {
  it('Should return a stream response', async () => {
    const app = new Hono()
    app.use(
      '*',
      reactRenderer(
        ({ children }) => {
          return (
            <html>
              <body>{children}</body>
            </html>
          )
        },
        { stream: true }
      )
    )
    app.get('/', (c) => c.render(<h1>Hello</h1>, { title: 'Title' }))
    const res = await app.request('/')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('Transfer-Encoding')).toBe('chunked')
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8')
    expect(await res.text()).toBe('<!DOCTYPE html><html><body><h1>Hello</h1></body></html>')
  })
})
