import type { BuiltInProviderType, RedirectableProviderType } from '@auth/core/providers'
import type { LoggerInstance, Session } from '@auth/core/types'
import * as React from 'react'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ClientSessionError, fetchData, now, parseUrl, useOnline } from './client.ts'
import type {
  WindowProps,
  AuthState,
  AuthClientConfig,
  SessionContextValue,
  SessionProviderProps,
  GetSessionParams,
  UseSessionOptions,
  LiteralUnion,
  SignInOptions,
  SignInAuthorizationParams,
  SignInResponse,
  ClientSafeProvider,
  SignOutParams,
  SignOutResponse,
} from './client.ts'

const logger: LoggerInstance = {
  debug: console.debug,
  error: console.error,
  warn: console.warn,
}

class AuthConfigManager {
  private static instance: AuthConfigManager | null = null
  private config: AuthClientConfig

  private constructor() {
    this.config = this.createDefaultConfig()
  }

  private createDefaultConfig(): AuthClientConfig {
    return {
      baseUrl: typeof window !== 'undefined' ? parseUrl(window.location.origin).origin : '',
      basePath: typeof window !== 'undefined' ? parseUrl(window.location.origin).path : '/api/auth',
      credentials: 'same-origin',
      lastSync: 0,
      session: null,
      fetchSession: async () => void 0,
    }
  }

  static getInstance(): AuthConfigManager {
    if (!AuthConfigManager.instance) {
      AuthConfigManager.instance = new AuthConfigManager()
    }
    return AuthConfigManager.instance
  }

  setConfig(userConfig: Partial<AuthClientConfig>): void {
    this.config = { ...this.config, ...userConfig }
  }

  getConfig(): AuthClientConfig {
    return this.config
  }

  initializeConfig(hasInitialSession: boolean): void {
    this.config.lastSync = hasInitialSession ? now() : 0
  }
}

export const authConfigManager: AuthConfigManager = AuthConfigManager.getInstance()

export const SessionContext: React.Context<SessionContextValue | undefined> = React.createContext<
  SessionContextValue | undefined
>(undefined)

function useInitializeSession(hasInitialSession: boolean, initialSession: Session | null) {
  const authConfig = authConfigManager.getConfig()
  const [session, setSession] = React.useState<Session | null>(initialSession)
  const [loading, setLoading] = React.useState(!hasInitialSession)

  useEffect(() => {
    authConfig.fetchSession = async ({ event } = {}) => {
      try {
        const isStorageEvent = event === 'storage'

        if (isStorageEvent || !authConfig.session) {
          authConfig.lastSync = now()
          authConfig.session = await getSession()
          setSession(authConfig.session)
          return
        }

        if (!event || !authConfig.session || now() < authConfig.lastSync) {
          return
        }

        authConfig.lastSync = now()
        authConfig.session = await getSession()
        setSession(authConfig.session)
      } catch (error) {
        logger.error(new ClientSessionError((error as Error).message, error as any))
      } finally {
        setLoading(false)
      }
    }

    authConfig.fetchSession()

    return () => {
      authConfig.lastSync = 0
      authConfig.session = null
      authConfig.fetchSession = async () => void 0
    }
  }, [])

  return { session, setSession, loading, setLoading }
}

function useVisibilityChangeEventListener(
  authConfig: AuthClientConfig,
  refetchOnWindowFocus: boolean
) {
  useEffect(() => {
    const abortController = new AbortController()
    const handleVisibilityChange = () => {
      if (refetchOnWindowFocus && document.visibilityState === 'visible') {
        authConfig.fetchSession({ event: 'visibilitychange' })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange, {
      signal: abortController.signal,
    })

    return () => abortController.abort()
  }, [refetchOnWindowFocus])
}

function useRefetchInterval(
  authConfig: AuthClientConfig,
  refetchInterval?: number,
  shouldRefetch?: boolean
) {
  useEffect(() => {
    if (refetchInterval && shouldRefetch) {
      const intervalId = setInterval(() => {
        if (authConfig.session) {
          authConfig.fetchSession({ event: 'poll' })
        }
      }, refetchInterval * 1000)
      return () => clearInterval(intervalId)
    }
  }, [refetchInterval, shouldRefetch])
}

export async function getSession(params?: GetSessionParams): Promise<Session | null> {
  const { baseUrl, basePath, credentials } = authConfigManager.getConfig()
  const session = await fetchData<Session>(
    'session',
    {
      baseUrl,
      basePath,
      credentials,
    },
    logger,
    params
  )
  return session
}

export async function getCsrfToken(): Promise<string> {
  const { baseUrl, basePath, credentials } = authConfigManager.getConfig()
  const response = await fetchData<{ csrfToken: string }>(
    'csrf',
    {
      baseUrl,
      basePath,
      credentials,
    },
    logger
  )
  return response?.csrfToken ?? ''
}

export function SessionProvider(props: SessionProviderProps): React.JSX.Element {
  if (!SessionContext) {
    throw new Error('React Context is unavailable in Server Components')
  }

  const { children, refetchInterval, refetchWhenOffline = true } = props

  const authConfig = authConfigManager.getConfig()

  const hasInitialSession = !!props.session

  authConfigManager.initializeConfig(hasInitialSession)

  const { session, setSession, loading, setLoading } = useInitializeSession(
    hasInitialSession,
    props.session ?? null
  )

  useVisibilityChangeEventListener(authConfig, props.refetchOnWindowFocus ?? true)

  const isOnline = useOnline()

  const shouldRefetch = refetchWhenOffline || isOnline

  useRefetchInterval(authConfig, refetchInterval, shouldRefetch)

  const contextValue: SessionContextValue = useMemo(
    () =>
      ({
        data: session,
        status: loading ? 'loading' : session ? 'authenticated' : 'unauthenticated',
        update: async (data) => {
          if (loading || !session) {
            return
          }
          setLoading(true)
          const updatedSession = await fetchData<Session>(
            'session',
            authConfig,
            logger,
            data ? { body: { csrfToken: await getCsrfToken(), data } } : undefined
          )
          setLoading(false)
          if (updatedSession) {
            setSession(updatedSession)
          }
          return updatedSession
        },
      }) as SessionContextValue,
    [session, loading, setSession]
  )

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>
}

export function useSession<R extends boolean>(
  options?: UseSessionOptions<R>
): SessionContextValue<R> {
  if (!SessionContext) {
    throw new Error('React Context is unavailable in Server Components')
  }

  const config = authConfigManager.getConfig()

  const session = useContext(SessionContext)

  const { required, onUnauthenticated } = options ?? {}

  const requiredAndNotLoading = required && session?.status === 'unauthenticated'

  useEffect(() => {
    if (requiredAndNotLoading) {
      const url = `${config.baseUrl}${config.basePath}/signin?${new URLSearchParams({
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
      data: session?.data,
      update: session?.update,
      status: 'loading',
    }
  }

  return session as SessionContextValue<R>
}

type ProvidersType = Record<LiteralUnion<BuiltInProviderType>, ClientSafeProvider>

export async function getProviders(): Promise<ProvidersType | null> {
  return fetchData<ProvidersType>('providers', authConfigManager.getConfig(), logger)
}

export async function signIn<P extends RedirectableProviderType | undefined = undefined>(
  provider?: LiteralUnion<
    P extends RedirectableProviderType ? P | BuiltInProviderType : BuiltInProviderType
  >,
  options: SignInOptions = {},
  authorizationParams: SignInAuthorizationParams = {}
): Promise<P extends RedirectableProviderType ? SignInResponse | undefined : undefined> {
  const { callbackUrl = window.location.href, redirect = true, ...opts } = options

  const config = authConfigManager.getConfig()

  const href = `${config.baseUrl}${config.basePath}`

  const providers = await getProviders()
  if (!providers) {
    window.location.href = `${href}/error`
    return
  }

  if (!provider || !(provider in providers)) {
    window.location.href = `${href}/signin?${new URLSearchParams({ callbackUrl })}`
    return
  }

  const isCredentials = providers[provider].type === 'credentials'
  const isEmail = providers[provider].type === 'email'

  const signInUrl = `${href}/${isCredentials ? 'callback' : 'signin'}/${provider}`

  const csrfToken = await getCsrfToken()
  const res = await fetch(`${signInUrl}?${new URLSearchParams(authorizationParams)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({ ...opts, csrfToken, callbackUrl }),
    credentials: config.credentials,
  })

  const data = (await res.json()) as { url: string }

  if (redirect) {
    const url = data.url ?? callbackUrl
    window.location.href = url

    if (url.includes('#')) {
      window.location.reload()
    }
    return
  }

  const error = new URL(data.url).searchParams.get('error')

  if (res.ok) {
    await config.fetchSession?.({ event: 'storage' })
  }

  return {
    error,
    status: res.status,
    ok: res.ok,
    url: error ? null : data.url,
  } as P extends RedirectableProviderType ? SignInResponse : undefined
}

export async function signOut<R extends boolean = true>(
  options?: SignOutParams<R>
): Promise<R extends true ? undefined : SignOutResponse> {
  const { callbackUrl = window.location.href, redirect = true } = options ?? {}
  const config = authConfigManager.getConfig()

  const csrfToken = await getCsrfToken()
  const res = await fetch(`${config.baseUrl}${config.basePath}/signout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({ csrfToken, callbackUrl }),
    credentials: config.credentials,
  })

  const data = (await res.json()) as { url: string }

  if (redirect) {
    const url = data.url ?? callbackUrl
    window.location.href = url

    if (url.includes('#')) {
      window.location.reload()
    }

    return undefined as R extends true ? undefined : SignOutResponse
  }

  await config.fetchSession?.({ event: 'storage' })

  return data as R extends true ? undefined : SignOutResponse
}

const createPopup = ({ url, title, height, width }: WindowProps) => {
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2.5
  const externalPopup = window.open(
    url,
    title,
    `width=${width},height=${height},left=${left},top=${top}`
  )
  return externalPopup
}

interface PopupLoginOptions extends Partial<Omit<WindowProps, 'url'>> {
  onSuccess?: () => void
  callbackUrl?: string
}

interface LoginState extends AuthState {
  popUpSignin: () => Promise<void>
}

export const useOauthPopupLogin = (
  provider: Parameters<typeof signIn>[0],
  options: PopupLoginOptions = {}
): LoginState => {
  const { width = 500, height = 500, title = 'Signin', onSuccess, callbackUrl = '/' } = options

  const [externalWindow, setExternalWindow] = useState<Window | null>()

  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const popUpSignin = useCallback(async () => {
    const res = await signIn(provider, {
      redirect: false,
      callbackUrl,
    })

    if (res?.error) {
      setState({ status: 'errored', error: res.error })
      return
    }
    setExternalWindow(
      createPopup({
        url: res?.url as string,
        title,
        width,
        height,
      })
    )
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent<AuthState>) => {
      if (event.origin !== window.location.origin) {
        return
      }
      if (event.data.status) {
        setState(event.data)
        if (event.data.status === 'success') {
          onSuccess?.()
        }
        externalWindow?.close()
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
      externalWindow?.close()
    }
  }, [externalWindow])

  return { popUpSignin, ...state }
}
