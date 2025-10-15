// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import OriginalRouter from '@medley/router'
// Should be exported from `hono/router`
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type { Result, Router } from 'hono/dist/types/router'

export class MedleyRouter<T> implements Router<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any
  name: string = 'MedleyRouter'

  constructor() {
    this.router = new OriginalRouter()
  }

  add(method: string, path: string, handler: T): void {
    const store = this.router.register(path)
    store[method] = handler
  }

  match(method: string, path: string): Result<T> {
    const route = this.router.find(path)

    if (route) {
      return [[[route['store'][method]], route['params']]]
    }

    return [[], []]
  }
}
