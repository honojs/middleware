import 'reflect-metadata';
import { validator } from 'hono/validator';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { Context, Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from 'hono';
import { ValidationError, validate } from 'class-validator';

type Hook<
  T,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  O = object,
> = (
  result: ({ success: true; } | { success: false; errors: ValidationError[] }) & {
    data: T;
    target: Target;
  },
  c: Context<E, P>,
) => Response | void | TypedResponse<O> | Promise<Response | void | TypedResponse<O>>;

type HasUndefined<T> = undefined extends T ? true : false;

type HasClassConstructor<T> = ClassConstructor<any> extends T ? true : false;

type StaticObject<T extends ClassConstructor<any>> = {
  [K in keyof InstanceType<T>]: InstanceType<T>[K];
};

const parseAndValidate = async <T extends ClassConstructor<any>>(dto: T, obj: object): 
  Promise<{ success: false; errors: ValidationError[] } | { success: true; output: InstanceType<T> }> => {
  // tranform the literal object to class object
  const objInstance = plainToClass(dto, obj, { enableImplicitConversion: true });
  // validating and check the errors, throw the errors if exist
  const errors = await validate(objInstance);
  // errors is an array of validation errors
  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return { success: true, output: objInstance as InstanceType<T> };
};

export const classValidatorV2 = <
  T extends ClassConstructor<any>,
  Output extends InstanceType<T> = InstanceType<T>,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  E extends Env = Env,
  P extends string = string,
  In = StaticObject<T>,
  I extends Input = {
    in: HasUndefined<In> extends true
      ? {
          [K in Target]?: K extends 'json'
            ? In
            : HasUndefined<keyof ValidationTargets[K]> extends true
              ? { [K2 in keyof In]?: ValidationTargets[K][K2] }
              : { [K2 in keyof In]: ValidationTargets[K][K2] };
        }
      : {
          [K in Target]: K extends 'json'
            ? In
            : HasUndefined<keyof ValidationTargets[K]> extends true
              ? { [K2 in keyof In]?: ValidationTargets[K][K2] }
              : { [K2 in keyof In]: ValidationTargets[K][K2] };
        };
    out: { [K in Target]: Output };
  },
  V extends I = I,
>(
  target: Target,
  dataType: T,
  hook?: Hook<Output, E, P, Target>,
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (data, c) => {
    const result = await parseAndValidate(dataType, data);

    if (hook) {
      const hookResult = hook({ ...result, data, target }, c)
      if (hookResult instanceof Response || hookResult instanceof Promise) {
        if ('response' in hookResult) {
          return hookResult.response;
        }
        return hookResult;
      }
    }

    if (!result.success) {
      return c.json({ errors: result.errors }, 400);
    }
    
    return result.output;
  });
