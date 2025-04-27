/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Submission } from '@conform-to/dom'
import type { Context, Env, Input as HonoInput, MiddlewareHandler, ValidationTargets } from 'hono'
import { getFormDataFromContext } from './utils'

type FormTargetValue = ValidationTargets['form']['string']

type GetInput<T extends ParseFn> = T extends (_: any) => infer S
  ? Awaited<S> extends Submission<any, any, infer V>
    ? V
    : never
  : never

type GetSuccessSubmission<S> = S extends { status: 'success' } ? S : never

type ParseFn = (formData: FormData) => Submission<unknown> | Promise<Submission<unknown>>

type Hook<F extends ParseFn, E extends Env, P extends string> = (
  submission: Awaited<ReturnType<F>>,
  c: Context<E, P>
) => Response | Promise<Response> | void | Promise<Response | void>

export const conformValidator = <
  F extends ParseFn,
  E extends Env,
  P extends string,
  In = GetInput<F>,
  Out = Awaited<ReturnType<F>>,
  I extends HonoInput = {
    in: {
      form: { [K in keyof In]: FormTargetValue }
    }
    out: { form: GetSuccessSubmission<Out> }
  },
>(
  parse: F,
  hook?: Hook<F, E, P>
): MiddlewareHandler<E, P, I> => {
  return async (c, next) => {
    const formData = await getFormDataFromContext(c)
    const submission = await parse(formData)

    if (hook) {
      const hookResult = hook(submission as any, c)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        return hookResult
      }
    }

    if (submission.status !== 'success') {
      return c.json(submission.reply(), 400)
    }

    c.req.addValidatedData('form', submission)

    await next()
  }
}
