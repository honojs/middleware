import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { MSEntraErrorResponse, MSEntraTokenResponse } from './types'

export async function refreshToken({
  client_id,
  client_secret,
  tenant_id,
  refresh_token,
}: {
  client_id: string
  client_secret: string
  tenant_id: string
  refresh_token: string
}): Promise<MSEntraTokenResponse> {
  if (!refresh_token) {
    throw new HTTPException(400, { message: 'missing refresh token' })
  }

  const params = toQueryParams({
    client_id,
    client_secret,
    refresh_token,
    grant_type: 'refresh_token',
  })

  const response = (await fetch(`https://login.microsoft.com/${tenant_id}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }).then((res) => res.json())) as MSEntraTokenResponse | MSEntraErrorResponse

  if ('error' in response) {
    throw new HTTPException(400, { message: response.error })
  }

  return response
}
