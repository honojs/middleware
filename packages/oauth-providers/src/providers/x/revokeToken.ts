import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { XErrorResponse, XRevokeResponse } from './types'

export async function revokeToken(
  client_id: string,
  client_secret: string,
  token: string
): Promise<boolean> {
  const authToken = btoa(`${encodeURIComponent(client_id)}:${encodeURIComponent(client_secret)}`)
  const params = toQueryParams({
    token,
    token_type_hint: 'access_token',
  })

  const response = (await fetch(`https://api.twitter.com/2/oauth2/revoke?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authToken}`,
    },
  }).then((res) => res.json())) as XRevokeResponse | XErrorResponse

  if ('error_description' in response) {
    throw new HTTPException(400, { message: response.error_description })
  }

  return response.revoked
}
