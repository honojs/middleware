import 'hono'

declare module 'hono' {
  interface ContextRenderer {
    (children: React.ReactElement, props?: Props): Response | Promise<Response>
  }
}
