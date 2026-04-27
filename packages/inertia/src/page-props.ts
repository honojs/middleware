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

type AllOutputs<App> = Distribute<
  {
    [Path in keyof ExtractSchema<App> & string]: {
      [Method in keyof ExtractSchema<App>[Path] &
        string]: ExtractSchema<App>[Path][Method] extends {
        output: infer O
      }
        ? Distribute<O>
        : never
    }[keyof ExtractSchema<App>[Path] & string]
  }[keyof ExtractSchema<App> & string]
>

type RenderOutput<App> =
  AllOutputs<App> extends infer U
    ? U extends { component: string; props: unknown }
      ? U
      : never
    : never

/**
 * Resolves the props type for a given Inertia page component name.
 *
 * Requires {@link AppRegistry} to be augmented with the Hono app type.
 */
export type PageProps<
  C extends RenderOutput<RegisteredApp>['component'] = RenderOutput<RegisteredApp>['component'],
> = Extract<RenderOutput<RegisteredApp>, { component: C }>['props']
