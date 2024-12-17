import { Hono } from 'hono'
import { ReDoc, redoc } from '../src'

describe('ReDoc Rendering', () => {
  const url = 'https://petstore3.swagger.io/api/v3/openapi.json'

  it('renders correctly with default UI version', () => {
    expect(ReDoc({ url }).toString()).toEqual(`
    <div>
      <script src="https://cdn.jsdelivr.net/npm/redoc/bundles/redoc.standalone.js" crossorigin="anonymous"></script>
      <div id="redoc-container"></div>
      <script>
        Redoc.init('${url}', {}, document.getElementById('redoc-container'));
      </script>
    </div>
  `)
  })

  it('renders correctly with specified UI version', () => {
    expect(ReDoc({ url, version: '2.2.0' }).toString()).toEqual(`
    <div>
      <script src="https://cdn.jsdelivr.net/npm/redoc@2.2.0/bundles/redoc.standalone.js" crossorigin="anonymous"></script>
      <div id="redoc-container"></div>
      <script>
        Redoc.init('${url}', {}, document.getElementById('redoc-container'));
      </script>
    </div>
  `)
  })

    it('renders correctly with custom UI', () => {
    expect(
      ReDoc({
        url,
        manuallyReDocHtml: (asset) =>
          `
        <div>
          <div id="redoc-manually"></div>
          ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"></script>`)}
          <script>
            window.onload = () => {
              Redoc.init('${url}', {}, document.getElementById('redoc-manually'));
            }
          </script>
        </div>
      `.trim(),
      }).toString()
    ).toEqual(
      `
        <div>
          <div id="redoc-manually"></div>
          <script src="https://cdn.jsdelivr.net/npm/redoc/bundles/redoc.standalone.js" crossorigin="anonymous"></script>
          <script>
            window.onload = () => {
              Redoc.init('${url}', {}, document.getElementById('redoc-manually'));
            }
          </script>
        </div>
    `.trim()
    )
  })
})

describe('ReDoc Middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('responds with status 200', async () => {
    app.get('/', redoc({ url: 'https://petstore3.swagger.io/api/v3/openapi.json' }))

    const res = await app.request('/')
    expect(res.status).toBe(200)
  })

  it('correctly renders ReDoc with custom options', async () => {
    app.get(
      '/',
      redoc({
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
        title: 'Custom UI',
      })
    )
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    console.log(html)
    expect(html).toContain('https://petstore3.swagger.io/api/v3/openapi.json') // RENDER_TYPE.STRING
    expect(html).toContain('<title>Custom UI</title>')
  })
})
