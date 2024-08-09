import { Enforcer } from 'casbin';
import { Context, MiddlewareHandler } from 'hono';

const getUserName = (c: Context): string => {
  const authHeader = c.req.raw.headers.get('Authorization');
  if (!authHeader) return '';
  const [type, credentials] = authHeader.split(' ');
  if (type !== 'Basic') return '';
  const decoded = atob(credentials);
  const [username] = decoded.split(':');
  return username;
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
