import type { StrictResponse} from 'msw'
import { HttpResponse, http } from 'msw'
import type { LinkedInTokenResponse } from '../src'

export const handlers = [
  http.post('https://www.linkedin.com/oauth/v2/accessToken', async ({ request }): Promise<StrictResponse<Partial<LinkedInTokenResponse>>> => {
    const code = new URLSearchParams(request.url).get('code')
    if (code === dummyCode) {
      return HttpResponse.json(linkedInToken)
    }
    return HttpResponse.json(linkedInCodeError)
  }),
  http.get('https://api.linkedin.com/v2/userinfo', () => HttpResponse.json(linkedInUser))
]

export const dummyCode = '4/0AfJohXl9tS46EmTA6u9x3pJQiyCNyahx4DLJaeJelzJ0E5KkT4qJmCtjq9n3FxBvO40ofg'
export const linkedInToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'email,openid,profile',
  refresh_token: 't4589fh-9gj3g93-34f5t64n',
  refresh_token_expires_in: 6000000,
  token_type: 'bearer'
}
export const linkedInCodeError = {
  error_description: '401',
  error: 'The Code you send is invalid.'
}
export const linkedInUser = {
  sub: '452FET361006',
  email_verified: true,
  name: 'Carlos Aldazosa',
  locale: {
    country: 'US',
    language: 'en'
  },
  given_name: 'Carlos',
  family_name: 'Aldazosa',
  email: 'example@email.com',
  picture: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png'
}