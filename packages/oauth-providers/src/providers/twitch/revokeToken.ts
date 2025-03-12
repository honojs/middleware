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

  const res = await fetch('https://id.twitch.tv/oauth2/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  // Check HTTP status code first
  if (!res.ok) {
    // Try to parse error response
    try {
      const errorResponse = await res.json() as TwitchRevokingResponse
      if (errorResponse && typeof errorResponse === 'object' && 'message' in errorResponse) {
        throw new HTTPException(400, { message: errorResponse.message })
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // If parsing fails, throw a generic error with the status
      throw new HTTPException(400, { message: `Token revocation failed with status: ${res.status}` })
    }
  }

  // Success case - Twitch returns 200 with empty body on successful revocation
  return true
}
