/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Env, MiddlewareHandler } from 'hono'

/** `Promise<T> | T`. */
export type MaybePromise<T> = Promise<T> | T

/** Whether `T` includes `undefined`. */
export type HasUndefined<T> = undefined extends T ? true : false

/** Turns `T | T[] | undefined` into `T[]`. */
export type AsArray<T> = T extends undefined ? [] : T extends any[] ? T : [T]

/** Like `Simplify`, but recursive. */
export type DeepSimplify<T> = {
  [KeyType in keyof T]: T[KeyType] extends Record<string, unknown>
    ? DeepSimplify<T[KeyType]>
    : T[KeyType]
} & {}

/** Infers the generics from a {@link MiddlewareHandler}. */
export type OfHandlerType<T extends MiddlewareHandler> =
  T extends MiddlewareHandler<infer E, infer P, infer I>
    ? {
        env: E
        path: P
        input: I
      }
    : never

/** Reduces a tuple of middleware handlers into a single composed handler. */
export type MiddlewareToHandlerType<M extends MiddlewareHandler<any, any, any>[]> = M extends [
  infer First,
  infer Second,
  ...infer Rest,
]
  ? First extends MiddlewareHandler<any, any, any>
    ? Second extends MiddlewareHandler<any, any, any>
      ? Rest extends MiddlewareHandler<any, any, any>[] // Ensure Rest is an array of MiddlewareHandler
        ? MiddlewareToHandlerType<
            [
              MiddlewareHandler<
                DeepSimplify<OfHandlerType<First>['env'] & OfHandlerType<Second>['env']>, // Combine envs
                OfHandlerType<First>['path'], // Keep path from First
                OfHandlerType<First>['input'] // Keep input from First
              >,
              ...Rest,
            ]
          >
        : never
      : never
    : never
  : M extends [infer Last]
    ? Last // Return the last remaining handler in the array
    : MiddlewareHandler<Env>

/** Normalizes an optional single value or array into an array. */
export const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}
