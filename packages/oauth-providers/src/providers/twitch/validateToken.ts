import { HTTPException } from 'hono/http-exception'
import type { TwitchValidateResponse } from './types'

export async function validateToken(
  token: string
): Promise<TwitchValidateResponse> {

  const response = await fetch('https://id.twitch.tv/oauth2/validate', {
    method: 'GET',
    headers: {
        authorization: `Bearer ${token}`,
    },
  }).then((res) => res.json() as Promise<TwitchValidateResponse>)

  if ('status' in response) {
    throw new HTTPException(400, { message: response.message })
  }

  return response
}
