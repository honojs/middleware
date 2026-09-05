import { HTTPException } from 'hono/http-exception'

import { toQueryParams } from '../../utils/objectToQuery'
import type { OpenStreetMapErrorResponse } from './types'

export async function revokeToken(
  client_id: string,
  client_secret: string,
  token: string
): Promise<boolean> {
  const response = await fetch('https://www.openstreetmap.org/oauth2/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toQueryParams({
      token,
      client_id,
      client_secret,
    }),
  })

  if (!response.ok) {
    const error = (await response.json()) as Partial<OpenStreetMapErrorResponse>
    throw new HTTPException(400, {
      message: error.error_description ?? error.error ?? `Status code: ${response.status}`,
    })
  }

  // RFC 7009 mandates an empty 200 response for a successful revocation.
  return true
}
