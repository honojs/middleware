/**
 * @module
 * Type helpers that derive page prop types from a Hono app's route schema.
 *
 * Users augment {@link AppRegistry} (typically from a generated `pages.gen.ts`
 * file) so that {@link PageProps} can resolve the props for a given page name.
 */

import type { ExtractSchema } from 'hono/types'

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

type RegisteredApp = AppRegistry extends { app: infer A } ? A : never

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
type NormalizeProps<T, All = T> =
  T extends Record<string, never>
    ? { [K in AllKeys<Exclude<All, Record<string, never>>>]?: never }
    : T

/**
 * Useful to flatten the type output to improve type hints shown in editors. And also to transform an interface into a type to aid with assignability.
 * @copyright from sindresorhus/type-fest
 */
type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Resolves the props type for a given Inertia page component name.
 *
 * Requires {@link AppRegistry} to be augmented with the Hono app type.
 */
export type PageProps<
  C extends RenderOutput<RegisteredApp>['component'] = RenderOutput<RegisteredApp>['component'],
> = C extends unknown
  ? Simplify<NormalizeProps<Extract<RenderOutput<RegisteredApp>, { component: C }>['props']>>
  : never
