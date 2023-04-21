// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import OriginalRouter from '@medley/router'
// Should be exported from `hono/router`
import type { Result, Router } from 'hono/dist/types/router'

export class MedleyRouter<T> implements Router<T> {
  router: any

  constructor() {
    this.router = new OriginalRouter()
  }

  add(method: string, path: string, handler: T) {
    const store = this.router.register(path)
    store[method] = handler
  }

  match(method: string, path: string): Result<T> | null {
    const route = this.router.find(path)

    if (route) {
      return {
        handlers: [route['store'][method]],
        params: route['params'],
      }
    }

    return null
  }
}
