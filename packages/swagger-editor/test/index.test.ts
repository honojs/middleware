import { Hono } from 'hono'
import { swaggerEditor } from "../src"
describe("Swagger Editor Middleware", () => {
    let app: Hono

    beforeEach(() => {
        app = new Hono()
    })

    it('responds with status 200', async () => {
        app.get('/swagger-editor', swaggerEditor())

        const res = await app.request('/swagger-editor')
        expect(res.status).toBe(200)
    })



    it('should contents shown', async () => {
        app.get('/swagger-editor', swaggerEditor({
            url: 'https://petstore3.swagger.io/api/v3/openapi.json'
        }))

        const res = await app.request('/swagger-editor')
        const html = await res.text()

        expect(html).toContain('https://petstore3.swagger.io/api/v3/openapi.json')
        expect(html).toContain('https://cdn.jsdelivr.net/npm/swagger-editor-dist')
    })

})