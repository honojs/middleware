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
            url: '${url}',
            dom_id: '#swagger-ui',
          })
        }
      </script>
    </div>
  `)
  })

  it('renders correctly with specified UI version', () => {
    expect(SwaggerUI({ url, ui: { version: '5.0.0' } }).toString()).toEqual(`
    <div>
      <div id="swagger-ui"></div>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css" />
      <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js" crossorigin="anonymous"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '${url}',
            dom_id: '#swagger-ui',
          })
        }
      </script>
    </div>
  `)
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
