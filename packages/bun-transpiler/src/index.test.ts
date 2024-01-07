import { Hono } from 'hono'
import { bunTranspiler } from '.'

const HOST = 'http://localhost'

const TS = 'const add = (a: number, b: number): number => a + b'
const TS_TRANSPILED = 'const add=(a,b)=>a+b;'
const TSX = 'const element = <h1>hello world</h1>'
const TSX_TRANSPILED =
  'const element=jsxDEV("h1",{children:"hello world"},undefined,false,undefined,this);'
const BAD = 'function { !!! !@#$ add(a: INT) return a + b + c; }'

describe('Bun Transpiler middleware', () => {
  const app = new Hono()

  app.use('*', bunTranspiler())

  app.get('/script.js', (c) => c.text(TS)) // Serve TS to test if it gets transpiled
  app.get('/script.ts', (c) => c.text(TS))
  app.get('/script.tsx', (c) => c.text(TSX))
  app.get('/bad.ts', (c) => c.text(BAD))

  it('Should ignore non typescript content paths', async () => {
    const res = await app.request(`${HOST}/script.js`)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(TS)
  })

  it('Should transpile typescript', async () => {
    const res = await app.request(`${HOST}/script.ts`)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(TS_TRANSPILED)
    expect(res.headers.get('content-type')).toBe('application/javascript')
  })

  it('Should transpile TSX', async () => {
    const res = await app.request(`${HOST}/script.tsx`)
    expect(res).not.toBeNull()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(TSX_TRANSPILED)
    expect(res.headers.get('content-type')).toBe('application/javascript')
  })

  it('Should return error on badly formed typescript', async () => {
    const res = await app.request(`${HOST}/bad.ts`)
    expect(res).not.toBeNull()
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Parse error')
    expect(res.headers.get('content-type')).toBe('text/plain')
  })
})
