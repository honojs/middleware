import { Effect } from 'effect'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

export const effect = async <ContextType extends Context, SuccessType>(
  program: Effect.Effect<SuccessType>,
  c: ContextType
) => {
  const result = await Effect.runPromise(program)

  result
}

const app = new Hono().get('/', (c) => effect(c))
