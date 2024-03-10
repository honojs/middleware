import { type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { Account, Client, type Models } from 'node-appwrite'


export interface AppwriteAuthConfig {
  endpoint: string,
  projectId: string,
  apiKey: string,
  cookieName: string,

}


export const initAppwrite = (config: AppwriteAuthConfig) => {
  return createMiddleware(async (c, next) => {
    const sessionClient = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)

    const adminClient = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey)

    c.set('appwriteConfig', config)
    c.set('sessionClient', sessionClient)
    c.set('adminClient', adminClient)

    await next()
  })
}

export const getAuth = (c: Context): Models.User<Models.Preferences> => {
  return c.get('appwriteUser')
}

export const appwriteMiddleware = () => {

  return createMiddleware(async (c, next) => {
    const config  = c.get('appwriteConfig')
    const session = getCookie(c, config.cookieName)

    if (!session) {
      throw new HTTPException(401, {
        res: new Response('Unauthorized', {
          status: 401,
        }),
      })
    }

    const sessionClient = c.get('sessionClient')
    sessionClient.setSession(session)

    const account = new Account(sessionClient)
    try {
      const user = await account.get()

      c.set('appwriteUser', user)

      await next()

    } catch (e) {
      throw new HTTPException(403, {
        res: new Response('Forbidden', {
          status: 403,
        }),
      })
    }
  })
}


/************* Helpers *************/

export const appwriteEmailLogin = () => {
  return async (c: Context) => {
    const body                = await c.req.json()
    const { email, password } = body
    const adminClient         = c.get('adminClient')
    const config              = c.get('appwriteConfig')
    const account             = new Account(adminClient)

    try {
      const session = await account.createEmailPasswordSession(email, password)

      setAppwriteCookie(c, config, session)

      return c.json({ success: true })
    } catch (e) {
      throw new HTTPException(401, {
        res: new Response('Unauthorized', {
          status: 401,
        }),
      })
    }
  }
}

export const appwriteOAuth2 = (provider: string, success: string, failure: string) => {
  return async (c: Context) => {
    const adminClient = c.get('adminClient')

    try {
      const account = new Account(adminClient)

      const redirectUrl = await account.createOAuth2Token(provider, success, failure)

      return c.redirect(redirectUrl)
    } catch (e) {
      throw new HTTPException(401, {
        res: new Response('Unauthorized', {
          status: 401,
        }),
      })
    }
  }
}

export const appwriteOAuth2Save = (redirect?: string) => {
  return async (c: Context) => {
    const adminClient = c.get('adminClient')
    const config      = c.get('appwriteConfig')

    const { userId, secret } = c.req.query()
    try {
      const account = new Account(adminClient)
      const session = await account.createSession(userId, secret)
      setAppwriteCookie(c, config, session)

      if (redirect) {
        return c.redirect(redirect)
      }

      return c.json({ success: true })
    } catch (e) {
      throw new HTTPException(401, {
        res: new Response('Unauthorized', {
          status: 401,
        }),
      })
    }
  }
}

function setAppwriteCookie(c: Context, config: AppwriteAuthConfig, session: Models.Session) {
  setCookie(c, config.cookieName, session.secret, {
    httpOnly: true,
    secure  : true,
    sameSite: 'Strict',
    expires : new Date(session.expire),
    path    : '/',
  })
}