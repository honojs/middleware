import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { XErrorResponse, XTokenResponse } from './types'

export async function refreshToken(
  client_id: string,
  client_secret: string,
  refresh_token: string
): Promise<XTokenResponse> {
  const authToken = btoa(`${encodeURIComponent(client_id)}:${encodeURIComponent(client_secret)}`)
  const params = toQueryParams({
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
  })

  const response = (await fetch(`https://api.twitter.com/2/oauth2/token?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authToken}`,
    },
  }).then((res) => res.json())) as XTokenResponse | XErrorResponse

  if ('error_description' in response)
    throw new HTTPException(400, { message: response.error_description })

  return response
}
