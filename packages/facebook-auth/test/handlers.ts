import type { StrictResponse} from 'msw'
import { HttpResponse, http } from 'msw'
import type { FacebookTokenResponse, FacebookUser } from '../src/index'

export const handlers = [
  http.get('https://graph.facebook.com/v18.0/oauth/access_token', async ({ request }): Promise<StrictResponse<Partial<FacebookTokenResponse>>> => {
    const code = new URLSearchParams(request.url).get('code')
    if (dummyCode === code) {
      return HttpResponse.json(dummyToken)
    }
    return HttpResponse.json(facebookCodeError)
  }),
  http.get('https://graph.facebook.com/v18.0/me', () => HttpResponse.json(facebookBasicInfo)),
  http.get('https://graph.facebook.com/1abc345-75uyut', async ({ request }): Promise<StrictResponse<Partial<FacebookUser>>> => {
    const token = new URLSearchParams(request.url).get('access_token')
    if (token === dummyToken.access_token) {
      return HttpResponse.json(facebookUser)
    }
    return HttpResponse.json(facebookTokenError)
  })
]

export const dummyCode = '4/0AfJohXl9tS46EmTA6u9x3pJQiyCNyahx4DLJaeJelzJ0E5KkT4qJmCtjq9n3FxBvO40ofg'
export const dummyToken = {
  access_token: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
  expires_in: 60000,
  scope: 'openid email profile'
}

export const facebookUser = {
  id: '1abc345-75uyut',
  name: 'Carlos Aldazosa',
  email: 'example@email.com',
  picture: {
    data: {
      height: 50,
      width: 50,
      is_silhouette: true,
      url: 'https://www.severnedgevets.co.uk/sites/default/files/guides/kitten.png',
    }
  },
  first_name: 'Carlos',
  last_name: 'Aldazosa',
  short_name: 'Carlos'
}
export const facebookCodeError = {
  error: {
    message: 'Invalid Code.',
    type: 'Invalid',
    code: 401,
    fbtrace_id: 'jujublabla'
  }
}
export const facebookTokenError = {
  error: {
    message: 'Invalid Token.',
    type: 'Invalid',
    code: 401,
    fbtrace_id: 'jujublabla'
  }
}
const facebookBasicInfo = {
  id: '1abc345-75uyut',
  name: 'Carlos Aldazosa'
}