/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BuiltInProviderType, RedirectableProviderType } from '@auth/core/providers'
import type { LoggerInstance, Session } from '@auth/core/types'
import * as React from 'react'
import { ClientSessionError, fetchData, now, parseUrl, useOnline } from './client'

import type {
  AuthClientConfig,
  ClientSafeProvider,
  LiteralUnion,
  SessionProviderProps,
  SignInAuthorizationParams,
  SignInOptions,
  SignInResponse,
  SignOutParams,
  SignOutResponse,
  UseSessionOptions,
} from './client'

// TODO: Remove/move to core?
export type {
  LiteralUnion,
  SignInOptions,
  SignInAuthorizationParams,
  SignOutParams,
  SignInResponse,
}

export { SessionProviderProps }

class AuthConfigManager {
  private static instance: AuthConfigManager | null = null
  _config: AuthClientConfig = {
    baseUrl: typeof window !== 'undefined' ? parseUrl(window.location.origin).origin : '',
    basePath: typeof window !== 'undefined' ? parseUrl(window.location.origin).path : '/api/auth',
    credentials: 'same-origin',
    _lastSync: 0,
    _session: undefined,
    _getSession: () => {},
  }

  static getInstance(): AuthConfigManager {
    if (!AuthConfigManager.instance) {
      AuthConfigManager.instance = new AuthConfigManager()
    }
    return AuthConfigManager.instance
  }

  setConfig(userConfig: Partial<AuthClientConfig>): void {
    this._config = { ...this._config, ...userConfig }
  }

  getConfig(): AuthClientConfig {
    return this._config
  }
}

export const authConfigManager = AuthConfigManager.getInstance()

function broadcast() {
  if (typeof BroadcastChannel !== 'undefined') {
    return new BroadcastChannel('auth-js')
  }
  return {
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

// TODO:
const logger: LoggerInstance = {
  debug: console.debug,
  error: console.error,
  warn: console.warn,
}

export type UpdateSession = (data?: any) => Promise<Session | null>

export type SessionContextValue<R extends boolean = false> = R extends true
  ?
      | { update: UpdateSession; data: Session; status: 'authenticated' }
      | { update: UpdateSession; data: null; status: 'loading' }
  :
      | { update: UpdateSession; data: Session; status: 'authenticated' }
      | {
          update: UpdateSession
          data: null
          status: 'unauthenticated' | 'loading'
        }

export const SessionContext = React.createContext?.<SessionContextValue | undefined>(undefined)

export function useSession<R extends boolean>(
  options?: UseSessionOptions<R>
): SessionContextValue<R> {
  if (!SessionContext) {
    throw new Error('React Context is unavailable in Server Components')
  }
  const __AUTHJS: AuthClientConfig = authConfigManager.getConfig()
  // @ts-expect-error Satisfy TS if branch on line below
  const value: SessionContextValue<R> = React.useContext(SessionContext)

  const { required, onUnauthenticated } = options ?? {}

  const requiredAndNotLoading = required && value.status === 'unauthenticated'

  React.useEffect(() => {
    if (requiredAndNotLoading) {
      const url = `${__AUTHJS.baseUrl}${__AUTHJS.basePath}/signin?${new URLSearchParams({
        error: 'SessionRequired',
        callbackUrl: window.location.href,
      })}`
      if (onUnauthenticated) {
        onUnauthenticated()
      } else {
        window.location.href = url
      }
    }
  }, [requiredAndNotLoading, onUnauthenticated])

  if (requiredAndNotLoading) {
    return {
      data: value.data,
      update: value.update,
      status: 'loading',
    }
  }

  return value
}

export interface GetSessionParams {
  event?: 'storage' | 'timer' | 'hidden' | string
  triggerEvent?: boolean
  broadcast?: boolean
}

export async function getSession(params?: GetSessionParams) {
  const session = await fetchData<Session>('session', authConfigManager.getConfig(), logger, params)
  if (params?.broadcast ?? true) {
    broadcast().postMessage({
      event: 'session',
      data: { trigger: 'getSession' },
    })
  }
  return session
}

export async function getCsrfToken() {
  const response = await fetchData<{ csrfToken: string }>(
    'csrf',
    authConfigManager.getConfig(),
    logger
  )
  return response?.csrfToken ?? ''
}

type ProvidersType = Record<LiteralUnion<BuiltInProviderType>, ClientSafeProvider>

export async function getProviders() {
  return fetchData<ProvidersType>('providers', authConfigManager.getConfig(), logger)
}

export async function signIn<P extends RedirectableProviderType | undefined = undefined>(
  provider?: LiteralUnion<
    P extends RedirectableProviderType ? P | BuiltInProviderType : BuiltInProviderType
  >,
  options?: SignInOptions,
  authorizationParams?: SignInAuthorizationParams
): Promise<P extends RedirectableProviderType ? SignInResponse | undefined : undefined> {
  const { callbackUrl = window.location.href, redirect = true } = options ?? {}

  const __AUTHJS: AuthClientConfig = authConfigManager.getConfig()

  const href = `${__AUTHJS.baseUrl}${__AUTHJS.basePath}`

  const providers = await getProviders()

  if (!providers) {
    window.location.href = `${href}/error`
    return
  }

  if (!provider || !(provider in providers)) {
    window.location.href = `${href}/signin?${new URLSearchParams({
      callbackUrl,
    })}`
    return
  }

  const isCredentials = providers[provider].type === 'credentials'
  const isEmail = providers[provider].type === 'email'
  const isSupportingReturn = isCredentials || isEmail

  const signInUrl = `${href}/${isCredentials ? 'callback' : 'signin'}/${provider}`

  const csrfToken = await getCsrfToken()
  const res = await fetch(`${signInUrl}?${new URLSearchParams(authorizationParams)}`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    // @ts-expect-error TODO: Fix this
    body: new URLSearchParams({ ...options, csrfToken, callbackUrl }),
    credentials: __AUTHJS.credentials,
  })

  const data = await res.json()

  // TODO: Do not redirect for Credentials and Email providers by default in next major
  if (redirect || !isSupportingReturn) {
    const url = (data as any).url ?? callbackUrl
    window.location.href = url
    // If url contains a hash, the browser does not reload the page. We reload manually
    if (url.includes('#')) {
      window.location.reload()
    }
    return
  }

  const error = new URL((data as any).url).searchParams.get('error')

  if (res.ok) {
    await __AUTHJS._getSession({ event: 'storage' })
  }

  return {
    error,
    status: res.status,
    ok: res.ok,
    url: error ? null : (data as any).url,
  } as any
}

/**
 * Initiate a signout, by destroying the current session.
 * Handles CSRF protection.
 */
export async function signOut<R extends boolean = true>(
  options?: SignOutParams<R>
): Promise<R extends true ? undefined : SignOutResponse> {
  const { callbackUrl = window.location.href } = options ?? {}
  const __AUTHJS: AuthClientConfig = authConfigManager.getConfig()
  const href = `${__AUTHJS.baseUrl}${__AUTHJS.basePath}`
  const csrfToken = await getCsrfToken()
  const res = await fetch(`${href}/signout`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({ csrfToken, callbackUrl }),
    credentials: __AUTHJS.credentials,
  })
  const data = await res.json()

  broadcast().postMessage({ event: 'session', data: { trigger: 'signout' } })

  if (options?.redirect ?? true) {
    const url = (data as any).url ?? callbackUrl
    window.location.href = url
    // If url contains a hash, the browser does not reload the page. We reload manually
    if (url.includes('#')) {
      window.location.reload()
    }
    // @ts-expect-error TODO: Fix this
    return
  }

  await __AUTHJS._getSession({ event: 'storage' })

  return data as any
}

export function SessionProvider(props: SessionProviderProps) {
  if (!SessionContext) {
    throw new Error('React Context is unavailable in Server Components')
  }

  const { children, refetchInterval, refetchWhenOffline } = props

  const __AUTHJS: AuthClientConfig = authConfigManager.getConfig()

  const hasInitialSession = props.session !== undefined

  __AUTHJS._lastSync = hasInitialSession ? now() : 0

  const [session, setSession] = React.useState(() => {
    if (hasInitialSession) {
      __AUTHJS._session = props.session
    }
    return props.session
  })

  const [loading, setLoading] = React.useState(!hasInitialSession)

  React.useEffect(() => {
    __AUTHJS._getSession = async ({ event } = {}) => {
      try {
        const storageEvent = event === 'storage'

        if (storageEvent || __AUTHJS._session === undefined) {
          __AUTHJS._lastSync = now()
          __AUTHJS._session = await getSession({
            broadcast: !storageEvent,
          })
          setSession(__AUTHJS._session)
          return
        }

        if (
          // If there is no time defined for when a session should be considered
          // stale, then it's okay to use the value we have until an event is
          // triggered which updates it
          !event ||
          // If the client doesn't have a session then we don't need to call
          // the server to check if it does (if they have signed in via another
          // tab or window that will come through as a "stroage" event
          // event anyway)
          __AUTHJS._session === null ||
          // Bail out early if the client session is not stale yet
          now() < __AUTHJS._lastSync
        ) {
          return
        }

        // An event or session staleness occurred, update the client session.
        __AUTHJS._lastSync = now()
        __AUTHJS._session = await getSession()
        setSession(__AUTHJS._session)
      } catch (error) {
        logger.error(new ClientSessionError((error as Error).message, error as any))
      } finally {
        setLoading(false)
      }
    }

    __AUTHJS._getSession()

    return () => {
      __AUTHJS._lastSync = 0
      __AUTHJS._session = undefined
      __AUTHJS._getSession = () => {}
    }
  }, [])

  React.useEffect(() => {
    const handle = () => __AUTHJS._getSession({ event: 'storage' })
    // Listen for storage events and update session if event fired from
    // another window (but suppress firing another event to avoid a loop)
    // Fetch new session data but tell it to not to fire another event to
    // avoid an infinite loop.
    // Note: We could pass session data through and do something like
    // `setData(message.data)` but that can cause problems depending
    // on how the session object is being used in the client; it is
    // more robust to have each window/tab fetch it's own copy of the
    // session object rather than share it across instances.
    broadcast().addEventListener('message', handle)
    return () => broadcast().removeEventListener('message', handle)
  }, [])

  React.useEffect(() => {
    const { refetchOnWindowFocus = true } = props
    // Listen for when the page is visible, if the user switches tabs
    // and makes our tab visible again, re-fetch the session, but only if
    // this feature is not disabled.
    const visibilityHandler = () => {
      if (refetchOnWindowFocus && document.visibilityState === 'visible') {
        __AUTHJS._getSession({ event: 'visibilitychange' })
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler, false)
    return () => document.removeEventListener('visibilitychange', visibilityHandler, false)
  }, [props.refetchOnWindowFocus])

  const isOnline = useOnline()
  // TODO: Flip this behavior in next major version
  const shouldRefetch = refetchWhenOffline !== false || isOnline

  React.useEffect(() => {
    if (refetchInterval && shouldRefetch) {
      const refetchIntervalTimer = setInterval(() => {
        if (__AUTHJS._session) {
          __AUTHJS._getSession({ event: 'poll' })
        }
      }, refetchInterval * 1000)
      return () => clearInterval(refetchIntervalTimer)
    }
  }, [refetchInterval, shouldRefetch])

  const value: any = React.useMemo(
    () => ({
      data: session,
      status: loading ? 'loading' : session ? 'authenticated' : 'unauthenticated',
      async update(data: any) {
        if (loading || !session) {
          return
        }
        setLoading(true)
        const newSession = await fetchData<Session>(
          'session',
          __AUTHJS,
          logger,
          typeof data === 'undefined'
            ? undefined
            : { body: { csrfToken: await getCsrfToken(), data } }
        )
        setLoading(false)
        if (newSession) {
          setSession(newSession)
          broadcast().postMessage({
            event: 'session',
            data: { trigger: 'getSession' },
          })
        }
        return newSession
      },
    }),
    [session, loading]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
