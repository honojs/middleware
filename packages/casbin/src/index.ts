import { Enforcer } from 'casbin';
import { type Context, type HonoRequest, MiddlewareHandler } from 'hono';
import { decodeBase64 } from 'hono/utils/encode'

const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/
const USER_PASS_REGEXP = /^([^:]*):(.*)$/
const utf8Decoder = new TextDecoder()

const auth = (req: HonoRequest) => {
  const match = CREDENTIALS_REGEXP.exec(req.header('Authorization') || '')
  if (!match) {
    return undefined
  }

  let userPass = undefined
  // If an invalid string is passed to atob(), it throws a `DOMException`.
  try {
    userPass = USER_PASS_REGEXP.exec(utf8Decoder.decode(decodeBase64(match[1])))
  } catch { } // Do nothing

  if (!userPass) {
    return undefined
  }

  return { username: userPass[1], password: userPass[2] }
}


const getUserName = (c: Context): string => {
  const requestUser = auth(c.req);
  if (!requestUser) {
    return '';
  }
  return requestUser.username;
}


const defaultCheckPermission = async (c: Context, enforcer: Enforcer): Promise<boolean> => {
  const { path, method } = c.req;
  const user = getUserName(c);
  return enforcer.enforce(user, path, method);
}

interface CasbinOptions {
  newEnforcer: Promise<Enforcer>;
  authorizer?: (c: Context, enforcer: Enforcer) => Promise<boolean>;
}

export const casbin = (opt: CasbinOptions): MiddlewareHandler => {
  return async (c, next) => {
    const enforcer = await opt.newEnforcer;
    if (!(enforcer instanceof Enforcer)) {
      return c.json({ error: 'Invalid enforcer' }, 500);
    }

    const checkPermission = opt.authorizer || defaultCheckPermission;
    const isAllowed = await checkPermission(c, enforcer);
    if (!isAllowed) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
