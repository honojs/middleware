import type { DefaultBodyType, StrictResponse} from 'msw'
import { HttpResponse, http } from 'msw'
import type { GoogleTokenResponse, GoogleUser } from '../src'

export const handlers = [
  // Google
  http.post('https://oauth2.googleapis.com/token', async ({ request }): Promise<StrictResponse<Partial<GoogleTokenResponse>>> => {
    const body = await request.json() as Promise<DefaultBodyType> & { code: string }
    if (body.code === dummyCode) {
      return HttpResponse.json(dummyToken)
    }
    return HttpResponse.json(googleCodeError)
  }),
  http.get('https://www.googleapis.com/oauth2/v2/userinfo', async ({ request }): Promise<StrictResponse<Partial<GoogleUser>>> => {
    const authorization = request.headers.get('authorization')
    if (authorization === `Bearer ${dummyToken.access_token}`) {
      return HttpResponse.json(googleUser)
    }
    return HttpResponse.json(googleTokenError)
  }),
  http.get('https://www.googleapis.com/oauth2/v1/tokeninfo', () => HttpResponse.json(googleTokenInfo))
]

export const dummyCode = '4/0AfJohXl9tS46EmTA6u9x3pJQiyCNyahx4DLJaeJelzJ0E5KkT4qJmCtjq9n3FxBvO40ofg'
export const dummyToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'openid email profile'
}

export const googleUser = {
  id: '1abc345-75uyut',
  email: 'example@email.com',
  verified_email: true,
  name: 'Carlos Aldazosa',
  given_name: 'Carlos',
  family_name: 'Aldazosa',
  picture: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png',
  locale: 'es-419'
}
export const googleCodeError = {
  error: {
    code: 401,
    message: 'Invalid code.',
    status: '401',
    error: 'code_invalid',
  },
  error_description: 'Invalid code.'
}
export const googleTokenError = {
  error: {
    code: 401,
    message: 'Invalid token.',
    status: '401',
    error: 'token_invalid',
    error_description: 'Invalid token.'
  }
}
const googleTokenInfo = {
  issued_to: 'hyr97.457_e5gh4',
  audience: 'hyr97.457_e5gh4google.com',
  user_id: 'dummy-id',
  scope: 'openid email profile',
  expires_in: 60000,
  email: 'example@email.com',
  verified_email: true,
  access_type: 'user'
}