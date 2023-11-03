import { Hono } from 'hono'
import { SwaggerUI, swaggerUI } from '../src'

describe('SwaggerUI Rendering', () => {
  const url = 'https://petstore3.swagger.io/api/v3/openapi.json'

  it('renders correctly with default UI version', () => {
    expect(SwaggerUI({ url }).toString()).toEqual(`
    <div>
      <div id="swagger-ui"></div>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
      <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js" crossorigin="anonymous"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            dom_id: '#swagger-ui',url: '${url}',
          })
        }
      </script>
    </div>
  `)
  })

  it('renders correctly with specified UI version', () => {
    expect(SwaggerUI({ url, version: '5.0.0' }).toString()).toEqual(`
    <div>
      <div id="swagger-ui"></div>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css" />
      <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js" crossorigin="anonymous"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            dom_id: '#swagger-ui',url: '${url}',
          })
        }
      </script>
    </div>
  `)
  })

  it('renders correctly with custom UI', () => {
    expect(
      SwaggerUI({
        url,
        manuallySwaggerUIHtml: (asset) => `
        <div>
          <div id="swagger-ui-manually"></div>
          ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`)}
          ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"></script>`)}
          <script>
            window.onload = () => {
              window.ui = SwaggerUIBundle({
                dom_id: '#swagger-ui-manually',
                url: '${url}',
              })
            }
          </script>
        </div>
      `.trim(),
      }).toString()
    ).toEqual(`
        <div>
          <div id="swagger-ui-manually"></div>
          <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
          <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js" crossorigin="anonymous"></script>
          <script>
            window.onload = () => {
              window.ui = SwaggerUIBundle({
                dom_id: '#swagger-ui-manually',
                url: '${url}',
              })
            }
          </script>
        </div>
    `.trim())
  })
})

describe('SwaggerUI Middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('responds with status 200', async () => {
    app.get('/', swaggerUI({ url: 'https://petstore3.swagger.io/api/v3/openapi.json' }))

    const res = await app.request('/')
    expect(res.status).toBe(200)
  })
})
