import { Hono } from 'hono'
import { describe, expectTypeOf, it } from 'vitest'
import type { PageProps } from './page-props'
import { inertia } from './index'

const _app = new Hono()
  .use(inertia())
  .get('/with-props', (c) => c.render('WithProps', { lazy: () => Promise.resolve({ id: 0 }) }))
  .get('/without-props', (c) => c.render('WithoutProps'))
  .post(
    '/optional-props',
    (c) => c.render('OptionalProps', { errors: { email: 'invalid' } }),
    (c) => c.render('OptionalProps')
  )
  .get(
    '/union-props',
    (c) => c.render('UnionProps', { a: 0 }),
    (c) => c.render('UnionProps', { b: 'string' })
  )

declare module '@hono/inertia' {
  interface AppRegistry {
    app: typeof _app
  }
}

describe('PageProps', () => {
  it('resolves lazy prop values', () => {
    expectTypeOf<PageProps<'WithProps'>>().toEqualTypeOf<{ lazy: { id: number } }>()
  })

  it('collapses the props of a render without props to {}', () => {
    expectTypeOf<PageProps<'WithoutProps'>>().toEqualTypeOf<{}>()
  })

  it('makes the props optional when multiple handlers render the same page with and without props', () => {
    expectTypeOf<PageProps<'OptionalProps'>>().toEqualTypeOf<{ errors?: { email: string } }>()
  })

  it('keeps non-empty props from multiple handlers', () => {
    expectTypeOf<PageProps<'UnionProps'>>().toEqualTypeOf<{ a: number } | { b: string }>()
  })
})
