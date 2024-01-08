import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { DiscordTokenResponse } from './types'

export async function refreshToken(
  client_id: string,
  client_secret: string,
  refresh_token: string
): Promise<DiscordTokenResponse> {
  const params = toQueryParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id,
    client_secret,
  })

  const response = (await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }).then((res) => res.json())) as DiscordTokenResponse | { error: string }

  if ('error' in response) throw new HTTPException(400, { message: response.error })

  return response
}
