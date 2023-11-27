import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'
import type { LinkedInErrorResponse, LinkedInTokenResponse } from './types'

export async function refreshToken(
  client_id: string,
  client_secret: string,
  refresh_token: string
): Promise<LinkedInTokenResponse> {
  const params = toQueryParams({
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
    client_id: client_id,
    client_secret: client_secret,
  })

  const response = (await fetch(`POST https://www.linkedin.com/oauth/v2/accessToken?${params}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).then((res) => res.json())) as LinkedInTokenResponse | LinkedInErrorResponse

  if ('error' in response) {
    throw new HTTPException(400, { message: response.error })
  }

  return response
}
