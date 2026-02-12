import { AuthError } from '@auth/core/errors'
import type { BuiltInProviderType, ProviderType } from '@auth/core/providers'
import type { LoggerInstance, Session } from '@auth/core/types'
import { useEffect, useState } from 'react'

class ClientFetchError extends AuthError {}

export class ClientSessionError extends AuthError {}

export interface GetSessionParams {
  event?: 'storage' | 'timer' | 'hidden' | string
  triggerEvent?: boolean
}

export interface AuthClientConfig {
  baseUrl: string
  basePath: string
  credentials: RequestCredentials
  lastSync: number
  session: Session | null
  fetchSession: (params?: GetSessionParams) => Promise<void>
}

export interface UseSessionOptions<R extends boolean> {
  required: R
  onUnauthenticated?: () => void
}

export type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)

export interface ClientSafeProvider {
  id: LiteralUnion<BuiltInProviderType>
  name: string
  type: ProviderType
  signinUrl: string
  callbackUrl: string
}

export interface SignInOptions extends Record<string, unknown> {
  callbackUrl?: string
  redirect?: boolean
}

export interface SignInResponse {
  error: string | undefined
  status: number
  ok: boolean
  url: string | null
}

export type SignInAuthorizationParams =
  | string
  | string[][]
  | Record<string, string>
  | URLSearchParams

export interface SignOutResponse {
  url: string
}

export interface SignOutParams<R extends boolean = true> {
  callbackUrl?: string
  redirect?: R
}

export interface SessionProviderProps {
  children: React.ReactNode
  session?: Session | null
  refetchInterval?: number
  refetchOnWindowFocus?: boolean
  refetchWhenOffline?: false
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

export type WindowProps = {
  url: string
  title: string
  width: number
  height: number
}

export type AuthState = {
  status: 'loading' | 'success' | 'errored'
  error?: string
}

export async function fetchData<T = any>(
  path: string,
  config: {
    baseUrl: string
    basePath: string
    credentials: RequestCredentials
  },
  logger: LoggerInstance,
  req: any = {}
): Promise<T | null> {
  const url = `${config.baseUrl}${config.basePath}/${path}`
  try {
    const options: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(req?.headers?.cookie ? { cookie: req.headers.cookie } : {}),
      },
      credentials: config.credentials,
    }

    if (req?.body) {
      options.body = JSON.stringify(req.body)
      options.method = 'POST'
    }

    const res = await fetch(url, options)
    const data = await res.json()
    if (!res.ok) {
      throw data
    }
    return data as T
  } catch (error) {
    logger.error(new ClientFetchError((error as Error).message, error as any))
    return null
  }
}

export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  )

  useEffect(() => {
    const abortController = new AbortController()
    const { signal } = abortController

    const setOnline = () => {
      setIsOnline(true)
    }
    const setOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', setOnline, { signal })
    window.addEventListener('offline', setOffline, { signal })

    return () => {
      abortController.abort()
    }
  }, [])

  return isOnline
}

export function now(): number {
  return Math.floor(Date.now() / 1000)
}

interface ParsedUrl {
  origin: string
  host: string
  path: string
  base: string
  toString: () => string
}

export function normalizeBasePath<T extends { basePath?: string }>(config: T): T {
  if (config.basePath && /^https?:\/\//.test(config.basePath)) {
    const url = new URL(config.basePath)
    return {
      ...config,
      baseUrl: url.origin,
      basePath: url.pathname.replace(/\/$/, ''),
    }
  }
  return config
}

export function parseUrl(url?: string): ParsedUrl {
  const defaultUrl = 'http://localhost:3000/api/auth'
  const parsedUrl = new URL(url ? (url.startsWith('http') ? url : `https://${url}`) : defaultUrl)
  const path = parsedUrl.pathname === '/' ? '/api/auth' : parsedUrl.pathname.replace(/\/$/, '')
  const base = `${parsedUrl.origin}${path}`

  return {
    origin: parsedUrl.origin,
    host: parsedUrl.host,
    path,
    base,
    toString: () => base,
  }
}
