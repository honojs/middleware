import { HTTPException } from 'hono/http-exception'
import type { GoogleErrorResponse, GoogleRefreshTokenResponse } from './types'

export async function refreshToken(
  client_id: string,
  client_secret: string,
  refresh_token: string
): Promise<GoogleRefreshTokenResponse> {
  if (!refresh_token) {
    throw new HTTPException(400, { message: 'Refresh token not found' })
  }

  const response = (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      client_id,
      client_secret,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  }).then((res) => res.json())) as GoogleRefreshTokenResponse | GoogleErrorResponse

  if (!('access_token' in response)) {
    throw new HTTPException(400, { message: response.error_description })
  }

  return response
}
