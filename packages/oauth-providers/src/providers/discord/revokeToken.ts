import { HTTPException } from 'hono/http-exception'
import { toQueryParams } from '../../utils/objectToQuery'

export async function revokeToken(
  client_id: string,
  client_secret: string,
  token: string
): Promise<boolean> {
  const params = toQueryParams({
    token_type_hint: 'access_token',
    token,
    client_id: client_id,
    client_secret,
  })

  const response = await fetch('https://discord.com/api/oauth2/token/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (response.status !== 200) throw new HTTPException(400, { message: 'Something went wrong' })

  return true
}
