/**
 * @module
 * Type helpers that derive page prop types from a Hono app's route schema and shared props.
 *
 * Users augment {@link AppRegistry} (typically from a generated `pages.gen.ts`
 * file) so that {@link PageProps} can resolve the props for a given page name.
 */

import type { HonoBase } from 'hono/hono-base'
import type { ExtractSchema } from 'hono/types'
import type { ResolvedProps } from './index'

/**
 * Augment this interface to register a Hono app instance for type-safe page props.
 *
 * @example
 * ```ts
 * import type app from './server'
 *
 * declare module '@hono/inertia' {
 *   interface AppRegistry {
 *     app: typeof app
 *   }
 * }
 * ```
 */
export interface AppRegistry {}

const SHARE_KEY: unique symbol = Symbol()

/**
 * Internal environment marker added by {@link inertia} for shared props.
 *
 * Used to infer shared props from a Hono app type.
 *
 * @internal
 */
export type InertiaSharedEnv<V> = {
  Variables: {
    [SHARE_KEY]: V
  }
}

type RegisteredApp = AppRegistry extends { app: infer A } ? A : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEnv<App> = App extends HonoBase<infer E, any, any, any> ? E : never

type SharedProps<App> =
  AppEnv<App> extends InertiaSharedEnv<infer V>
    ? V extends Record<string, never>
      ? {}
      : ResolvedProps<V>
    : {}

type Distribute<T> = T extends infer U ? U : never

type MethodOutput<MethodSchema> = MethodSchema extends { output: infer O } ? Distribute<O> : never

type AllOutputs<App> = Distribute<
  {
    [Path in keyof ExtractSchema<App> & string]: {
      [Method in keyof ExtractSchema<App>[Path] & string]: MethodOutput<
        ExtractSchema<App>[Path][Method]
      >
    }[keyof ExtractSchema<App>[Path] & string]
  }[keyof ExtractSchema<App> & string]
>

type RenderOutput<App> =
  AllOutputs<App> extends infer U
    ? U extends { component: string; props: unknown }
      ? U
      : never
    : never

type AllKeys<T> = T extends unknown ? keyof T : never

/**
 * Props-less renders are normalized to the other renders' keys as optional `never`,
 * so access keeps working while the value may still be `undefined`.
 */
type NormalizeProps<T, Shared, All = T> =
  T extends Record<string, never>
    ? { [K in Exclude<AllKeys<Exclude<All, Record<string, never>>>, keyof Shared>]?: never }
    : T

/**
 * Useful to flatten the type output to improve type hints shown in editors. And also to transform an interface into a type to aid with assignability.
 * @copyright from sindresorhus/type-fest
 */
type Simplify<T> = { [K in keyof T]: T[K] } & {}

type MergeProps<Shared, Own> = Own extends unknown ? Simplify<Omit<Shared, keyof Own> & Own> : never

/**
 * Resolves page props from an explicit Hono app type.
 *
 * Kept internal so type tests can define isolated apps
 * without relying on the global {@link AppRegistry}.
 *
 * @internal
 */
export type PagePropsFor<
  App,
  C extends RenderOutput<App>['component'] = RenderOutput<App>['component'],
> = C extends unknown
  ? MergeProps<
      SharedProps<App>,
      NormalizeProps<Extract<RenderOutput<App>, { component: C }>['props'], SharedProps<App>>
    >
  : never

/**
 * Resolves the props type for a given Inertia page component name.
 *
 * Requires {@link AppRegistry} to be augmented with the Hono app type.
 */
export type PageProps<
  C extends RenderOutput<RegisteredApp>['component'] = RenderOutput<RegisteredApp>['component'],
> = PagePropsFor<RegisteredApp, C>
