import { Hono } from 'hono'
import type { Context } from 'hono'
import { describe, expectTypeOf, it } from 'vitest'
import type { PagePropsFor } from './page-props'
import { inertia } from './index'

describe('PageProps', () => {
  it('restricts component names to the app routes', () => {
    const _app = new Hono().use(inertia()).get('/', (c) => c.render('Exists'))

    // @ts-expect-error Unknown is not rendered by _app.
    type UnknownPageProps = PagePropsFor<typeof _app, 'Unknown'>

    expectTypeOf<UnknownPageProps>().toBeNever()
  })

  it('resolves lazy props', () => {
    const _app = new Hono()
      .use(inertia())
      .get('/', (c) => c.render('LazyProps', { lazy: () => Promise.resolve({ id: 0 }) }))

    expectTypeOf<PagePropsFor<typeof _app, 'LazyProps'>>().toEqualTypeOf<{
      lazy: { id: number }
    }>()
  })

  it('normalizes renders without props to {}', () => {
    const _app = new Hono().use(inertia()).get('/', (c) => c.render('WithoutProps'))

    expectTypeOf<PagePropsFor<typeof _app, 'WithoutProps'>>().toEqualTypeOf<{}>()
  })

  it('normalizes unions with empty props', () => {
    const _app = new Hono().use(inertia()).get(
      '/',
      (c) => c.render('UnionWithEmptyProps'),
      (c) => c.render('UnionWithEmptyProps', { kind: 'ok' as const, value: 0 }),
      (c) => c.render('UnionWithEmptyProps', { kind: 'ng' as const, error: 'message' })
    )

    expectTypeOf<PagePropsFor<typeof _app, 'UnionWithEmptyProps'>>().toEqualTypeOf<
      | { kind: 'ok'; value: number }
      | { kind: 'ng'; error: string }
      | { kind?: never; value?: never; error?: never }
    >()
  })

  it('preserves unions without empty props', () => {
    const _app = new Hono().use(inertia()).get(
      '/',
      (c) => c.render('UnionWithoutEmptyProps', { a: 0 }),
      (c) => c.render('UnionWithoutEmptyProps', { b: 'string' })
    )

    expectTypeOf<PagePropsFor<typeof _app, 'UnionWithoutEmptyProps'>>().toEqualTypeOf<
      { a: number } | { b: string }
    >()
  })

  it('infers shared props from a share callback with an explicit Env', () => {
    type Session = { user: { name: string } }
    type SessionEnv = { Variables: { session: Session | null } }

    const _app = new Hono()
      .use(inertia({ share: (c: Context<SessionEnv>) => ({ session: c.get('session') }) }))
      .get('/', (c) => c.render('Shared'))

    expectTypeOf<PagePropsFor<typeof _app, 'Shared'>>().toEqualTypeOf<{
      session: { user: { name: string } } | null
    }>()
  })

  it('merges shared props and prefers page props for duplicate keys', () => {
    const _app = new Hono()
      .use(
        inertia({
          share: () => ({
            static: 'value',
            lazy: () => Promise.resolve({ id: 0 }),
            duplicated: 0,
          }),
        })
      )
      .get('/', (c) => c.render('MergedProps', { duplicated: 'string', own: true }))

    expectTypeOf<PagePropsFor<typeof _app, 'MergedProps'>>().toEqualTypeOf<{
      static: string
      lazy: { id: number }
      duplicated: string
      own: boolean
    }>()
  })

  it('merges shared props into unions without empty props', () => {
    const _app = new Hono().use(inertia({ share: () => ({ value: 'shared' }) })).get(
      '/',
      (c) => c.render('UnionWithoutEmptyProps', { kind: 'ok' as const, value: 0 }),
      (c) => c.render('UnionWithoutEmptyProps', { kind: 'ng' as const, error: 'message' })
    )

    expectTypeOf<PagePropsFor<typeof _app, 'UnionWithoutEmptyProps'>>().toEqualTypeOf<
      { kind: 'ok'; value: number } | { kind: 'ng'; value: string; error: string }
    >()
  })

  it('merges shared props into unions with empty props', () => {
    const _app = new Hono().use(inertia({ share: () => ({ value: 'shared' }) })).get(
      '/',
      (c) => c.render('UnionWithEmptyProps'),
      (c) => c.render('UnionWithEmptyProps', { kind: 'ok' as const, value: 0 }),
      (c) => c.render('UnionWithEmptyProps', { kind: 'ng' as const, error: 'message' })
    )

    expectTypeOf<PagePropsFor<typeof _app, 'UnionWithEmptyProps'>>().toEqualTypeOf<
      | { value: string; kind?: never; error?: never }
      | { kind: 'ok'; value: number }
      | { kind: 'ng'; value: string; error: string }
    >()
  })
})
