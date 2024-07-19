/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Env, Input as HonoInput, MiddlewareHandler, ValidationTargets } from 'hono'
import type { Submission } from '@conform-to/dom'
import { getFormDataFromContext } from './utils'

type FormTargetValue = ValidationTargets['form']['string']

type GetInput<T extends ParseFn> = T extends (_: any) => infer S
  ? Awaited<S> extends Submission<any, any, infer V>
    ? V
    : never
  : never

type ParseFn = (formData: FormData) => Submission<unknown> | Promise<Submission<unknown>>

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
    out: { form: Out }
  }
>(
  parse: F
): MiddlewareHandler<E, P, I> => {
  return async (ctx, next) => {
    const formData = await getFormDataFromContext(ctx)
    const submission = parse(formData)

    ctx.req.addValidatedData('form', submission)

    await next()
  }
}
