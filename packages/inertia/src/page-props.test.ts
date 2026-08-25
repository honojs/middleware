import { Hono } from 'hono'
import { describe, expectTypeOf, it } from 'vitest'
import type { PageProps } from './page-props'
import { inertia } from './index'

const _app = new Hono()
  .use(inertia())
  .get('/lazy-props', (c) => c.render('LazyProps', { lazy: () => Promise.resolve({ id: 0 }) }))
  .get('/without-props', (c) => c.render('WithoutProps'))
  .get(
    '/union-props',
    (c) => c.render('UnionProps'),
    (c) => c.render('UnionProps', { kind: 'ok' as const, value: 0 }),
    (c) => c.render('UnionProps', { kind: 'ng' as const, error: 'message' })
  )

declare module '@hono/inertia' {
  interface AppRegistry {
    app: typeof _app
  }
}

describe('PageProps', () => {
  it('resolves lazy props', () => {
    expectTypeOf<PageProps<'LazyProps'>>().toEqualTypeOf<{ lazy: { id: number } }>()
  })

  it('normalizes renders without props to {}', () => {
    expectTypeOf<PageProps<'WithoutProps'>>().toEqualTypeOf<{}>()
  })

  it('normalizes union types', () => {
    expectTypeOf<PageProps<'UnionProps'>>().toEqualTypeOf<
      | { kind: 'ok'; value: number }
      | { kind: 'ng'; error: string }
      | { kind?: never; value?: never; error?: never }
    >()
  })
})
