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
  app.use('*', esbuildTranspiler())
  app.get('/file.ts', (c) => c.text(TS))
  app.get('/file.js', (c) => c.text(TS))
  app.get('/bad.ts', (c) => c.text(BAD))
  app.get('/file.tsx', (c) => c.text(TSX))

  it('Should transpile typescript', async () => {
    // Request a Typescript page
    const res = await app.request('http://localhost/file.ts')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(nw(await res.text())).toBe('function add(a, b) { return a + b; }')
  })

  it('Should not touch non TS content paths', async () => {
    // Request a Typescript page
    const res = await app.request('http://localhost/file.js')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(nw(await res.text())).toBe(TS)
  })

  it('Should not meddle with with badly formed TS', async () => {
    const res = await app.request('http://localhost/bad.ts')
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(nw(await res.text())).toBe(BAD)
  })

  it('Should transpile TSX', async () => {
    const res = await app.request('http://localhost/file.tsx')
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(nw(await res.text())).toBe('/* @__PURE__ */ React.createElement("h1", null, "Hello");')
  })
})
