import { Hono } from 'hono'
import { describe, it, expect } from 'vitest'
import { esbuildTranspiler } from '../src/transpilers/node'

const TS = 'function add(a: number, b: number) { return a + b; }'
const BAD = 'function { !!! !@#$ add(a: INT) return a + b + c; }'
const TSX = '<h1>Hello</h1>'

// No Whitespace
// Returns a code representation where every space chain has been collapsed
// Needed because different transpiler may produce different whitespace
function nw(code: string) {
  return code.replace(/\s+/g, ' ').trim()
}

describe('esbuild Transpiler middleware', () => {
  const app = new Hono()

  app.use('/static/*', esbuildTranspiler())
  app.get('/static/file.ts', (c) =>
    c.text(TS, 200, {
      // Set a dummy content-type since Serve Static Middleware may set a unexpected content-type.
      'content-type': 'x-content-type',
    })
  )
  app.get('/static/file.js', (c) => c.text(TS))
  app.get('/static/bad.ts', (c) => c.text(BAD))
  app.get('/static/file.tsx', (c) => c.text(TSX))

  app.get(
    '/static-custom-content-type.ts',
    esbuildTranspiler({
      contentType: 'x-text/javascript',
    }),
    (c) => c.text(TS)
  )

  it('Should transpile typescript', async () => {
    // Request a Typescript page
    const res = await app.request('http://localhost/static/file.ts')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/javascript')
    expect(nw(await res.text())).toBe('function add(a, b) { return a + b; }')
  })

  it('Should transpile typescript with a custom content-type', async () => {
    // Request a Typescript page
    const res = await app.request('http://localhost/static-custom-content-type.ts')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('x-text/javascript')
  })

  it('Should not touch non TS content paths', async () => {
    // Request a Typescript page
    const res = await app.request('http://localhost/static/file.js')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(nw(await res.text())).toBe(TS)
  })

  it('Should not meddle with with badly formed TS', async () => {
    const res = await app.request('http://localhost/static/bad.ts')
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toBe('text/javascript')
    expect(nw(await res.text())).toBe(BAD)
  })

  it('Should transpile TSX', async () => {
    const res = await app.request('http://localhost/static/file.tsx')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(nw(await res.text())).toBe('/* @__PURE__ */ React.createElement("h1", null, "Hello");')
  })
})
