import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { TwitchRevokingResponse } from './types'

export async function revokeToken(
  client_id: string,
  token: string
): Promise<boolean> {
  const params = toQueryParams({
    client_id: client_id,
    token,
  })

  const response = await fetch('https://id.twitch.tv/oauth2/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }).then((res) => res.json<TwitchRevokingResponse>())

  if (response.status === 400) {
    throw new HTTPException(400, { message: response.message })
  }

  if (response.status === 401) {
    throw new HTTPException(401, { message: response.message })
  }

  return true
}
