import type { Infer, InferIn, Schema, ValidationIssue } from '@decs/typeschema'
import { validate } from '@decs/typeschema'
import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'

export type Hook<T, E extends Env, P extends string, O = {}> = (
  result:
    | { success: true; data: T; inputData: unknown }
    | { success: false; issues: Array<ValidationIssue>; inputData: unknown },
  c: Context<E, P>,
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<O>

type HasUndefined<T> = undefined extends T ? true : false


type HTTPExceptionOptions = {
    res?: Response;
    message?: string;
    data?:unknown
};

export class ValidationError extends HTTPException {

  private data:unknown
  constructor(
    options?: HTTPExceptionOptions,
  ) {
    /* Calling the constructor of the parent class (Error) and passing the message. */
    super(400,options)
    this.data=options?.data
    Error.captureStackTrace(this, this.constructor)

    Object.setPrototypeOf(this, ValidationError.prototype)
    this.name = this.constructor.name
  }

  getData(){
    return this.data
  }

  toJSON(){
    return {
      status: this.status,
      message: this.message,
      data: this.data
    }
  }
}

export const schemaValidator = <
  T extends Schema,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  I = InferIn<T>,
  O = Infer<T>,
  V extends {
    in: HasUndefined<I> extends true ? { [K in Target]?: I } : { [K in Target]: I }
    out: { [K in Target]: O }
  } = {
    in: HasUndefined<I> extends true ? { [K in Target]?: I } : { [K in Target]: I }
    out: { [K in Target]: O }
  },
>(
  target: Target,
  schema: T,
  hook?: Hook<Infer<T>, E, P>,
): MiddlewareHandler<E, P, V> =>
  validator(target, async (value, c) => {
    const result = await validate(schema, value)

    if (hook) {
      const hookResult = hook({ inputData: value, ...result }, c)
      if (hookResult) {
        if (hookResult instanceof Response || hookResult instanceof Promise) {
          return hookResult
        }
        if ('response' in hookResult) {
          return hookResult.response
        }
      }
    }

    if (!result.success) {
       throw new ValidationError({ message: 'Custom error message',data:{issues:result.issues,target} })
    }

    const data = result.data as Infer<T>
    return data
  })
