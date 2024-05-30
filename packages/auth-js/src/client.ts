import { AuthError } from '@auth/core/errors'
import type { BuiltInProviderType, ProviderType } from '@auth/core/providers'
import type { LoggerInstance, Session } from '@auth/core/types'
import * as React from 'react'

class ClientFetchError extends AuthError {}

export class ClientSessionError extends AuthError {}

export interface AuthClientConfig {
  baseUrl: string
  basePath: string
  credentials?: RequestCredentials
  _session?: Session | null | undefined
  _lastSync: number
  _getSession: (...args: any[]) => any
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
  /**
   * Specify to which URL the user will be redirected after signing in. Defaults to the page URL the sign-in is initiated from.
   *
   * [Documentation](https://next-auth.js.org/getting-started/client#specifying-a-callbackurl)
   */
  callbackUrl?: string
  /** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option) */
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
  /** [Documentation](https://next-auth.js.org/getting-started/client#specifying-a-callbackurl-1) */
  callbackUrl?: string
  /** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option-1 */
  redirect?: R
}


export interface SessionProviderProps {
  children: React.ReactNode
  session?: Session | null
  baseUrl?: string
  basePath?: string
  refetchInterval?: number
  refetchOnWindowFocus?: boolean
  refetchWhenOffline?: false
}

export async function fetchData<T = any>(
  path: string,
  config: AuthClientConfig,
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

export function useOnline() {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : false
  )

  React.useEffect(() => {
    const setOnline = () => setIsOnline(true)
    const setOffline = () => setIsOnline(false)

    window.addEventListener('online', setOnline)
    window.addEventListener('offline', setOffline)

    return () => {
      window.removeEventListener('online', setOnline)
      window.removeEventListener('offline', setOffline)
    }
  }, [])

  return isOnline
}

export function now() {
  return Math.floor(Date.now() / 1000)
}

export function parseUrl(url?: string) {
  const defaultUrl = 'http://localhost:3000/api/auth';
  const parsedUrl = new URL(url?.startsWith('http') ? url : `https://${url}` || defaultUrl);

  const path = parsedUrl.pathname === '/' ? '/api/auth' : parsedUrl.pathname.replace(/\/$/, '');
  const base = `${parsedUrl.origin}${path}`;

  return {
    origin: parsedUrl.origin,
    host: parsedUrl.host,
    path,
    base,
    toString: () => base,
  };
}
