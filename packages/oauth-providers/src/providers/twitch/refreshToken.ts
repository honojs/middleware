import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { TwitchRefreshResponse } from './types'

export async function refreshToken(
  client_id: string,
  client_secret: string,
  refresh_token: string
): Promise<TwitchRefreshResponse> {
  const params = toQueryParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id,
    client_secret,
  })

  const response = (await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }).then((res) => res.json() as Promise<TwitchRefreshResponse>))

  if ('error' in response) {
    throw new HTTPException(400, { message: response.error })
  }
  
  if ('message' in response) {
    throw new HTTPException(400, { message: response.message as string })
  }

  return response
}
