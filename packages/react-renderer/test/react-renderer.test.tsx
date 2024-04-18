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

  it('nested layout with Layout', async () => {
    const app = new Hono()
    app.use(
      '*',
      // @ts-expect-error - `title` is not defined
      reactRenderer(({ children, title, Layout }) => {
        return (
          <Layout>
            <html>
              <head>{title}</head>
              <body>{children}</body>
            </html>
          </Layout>
        )
      })
    )

    const app2 = new Hono()
    app2.use(
      '*',
      // @ts-expect-error - `title` is not defined
      reactRenderer(({ children, Layout, title }) => {
        return (
          <Layout title={title}>
            <div className='nested'>{children}</div>
          </Layout>
        )
      })
    )
    app2.get('/', (c) => c.render(<h1>http://localhost/nested</h1>, { title: 'Nested' }))

    const app3 = new Hono()
    app3.use(
      '*',
      // @ts-expect-error - `title` is not defined
      reactRenderer(({ children, Layout, title }) => {
        return (
          <Layout title={title}>
            <div className='nested2'>{children}</div>
          </Layout>
        )
      })
    )
    app3.get('/', (c) => c.render(<h1>http://localhost/nested</h1>, { title: 'Nested2' }))
    app2.route('/nested2', app3)

    app.route('/nested', app2)

    let res = await app.request('http://localhost/nested')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      '<html><head>Nested</head><body><div class="nested"><h1>http://localhost/nested</h1></div></body></html>'
    )

    res = await app.request('http://localhost/nested/nested2')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(
      '<html><head>Nested2</head><body><div class="nested"><div class="nested2"><h1>http://localhost/nested</h1></div></div></body></html>'
    )
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

  it('Should return as streaming content with headers added in a handler', async () => {
    const app = new Hono()
    app.use(reactRenderer(({ children }) => <>{children}</>, { stream: true }))
    app.get('/', (c) => {
      c.header('X-Message-Set', 'Hello')
      c.header('X-Message-Append', 'Hello', { append: true })
      return c.render(<h1>Hi</h1>, { title: 'Hi' })
    })
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('Transfer-Encoding')).toBe('chunked')
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8')
    expect(res.headers.get('X-Message-Set')).toBe('Hello')
    expect(res.headers.get('X-Message-Append')).toBe('Hello')
    expect(await res.text()).toBe('<h1>Hi</h1>')
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
