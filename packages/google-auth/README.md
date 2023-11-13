# Google Auth Middleware
Authentication middleware for [Hono](https://github.com/honojs/hono). This package offers a straightforward API for Google login.

## Usage
In your Google Cloud App settings add the **Redirect uri**. This middleware handles the redirect uri internally as the route you are using the middleware on, so if you decide to use the middleware on the route `/api/v1/auth/google/` the redirect uri will be `DOMAIN/api/v1/auth/google`.
```
app.use(
  "api/v1/auth/google", // -> redirect_uri by default
  googleAuth({ ... })
)
```

Also, there is two ways to use this middleware:
```
app.use(
	'/google',
	googleAuth({ ... })
)

app.get(
	'/google',
	(c) => {
		// Handle authentication
	}
)

export default app
```

Or 
```
app.get(
	'/google',
	googleAuth({ ... }),
	(c) => {
		// Handle authentication
	}
)

export default app

```

### googleAuth
```
import { Hono } from  'hono'
import { GoogleAuthVariables,googleAuth } from  '@hono/open-auth'

const  app  =  new  Hono<{ Variables:  GoogleAuthVariables }>()

app.use(
  '/google',
  googleAuth({
    client_id:  Bun.env.GOOGLE_ID,
		client_secret:  Bun.env.GOOGLE_SECRET,
		response_type: "code",
		scope: ["openid", "email", "profile"],
		include_granted_scopes:  true,
		state:  "sdygz76x-sd3gds2",
  })
)

export  default  app
```
#### Parameters
- `client_id`:
 	- Type: `string`.
	- `Required`.
	-  Your app client ID. You can find this value in the API Console [Credentials page](https://console.developers.google.com/apis/credentials). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GOOGLE_ID=`.
- `client_secret`:
	- Type: `string`.
	- `Required`.
	- Your app client secret. You can find this value in the API Console [Credentials page](https://console.developers.google.com/apis/credentials). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GOOGLE_SECRET=`.
	> Do not share your client secret to ensure the security of your app.
- `scope`:
	- Type: `string[]`.
	- `Required`.
	- Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Google offers for utilizing their API on the [OAuth 2.0 Scopes page](https://developers.google.com/identity/protocols/oauth2/scopes). 
	> If your app is not **verified** by Google, the accessible scopes for your app are significantly **limited**.
- `response_type`:
	- Type: `string`.
	- `Required`.
	- Choose the **OAuth flow** for the authentication process. The available options are:
		- `code` for a more secure flow, applicable when the app's authentication flow is managed by the **server side**.
		- `token` for quick access to the token, suitable when the app's authentication flow will be managed by the **client side**.
- `include_granted_scopes`:
	- Type: `boolean`.
	- `Optional`.
	- To obtain the scopes for which the user has **granted permission**, set this value to `true`. This will allow you to implement a flow in cases where your app cannot access crucial permissions and needs to request them again, among other use cases.  Value `false` by default.
- `login_hint`:
	- Type: `string`.
	- `Optional`.
	- Set the parameter value to an email address or `sub` identifier to provide a hint to the Google Authentication Server who is asking for authentication.
- `prompt`:
	- Type: `string`.
	- `Optional`.
	- Define the prompt the user will receive when logging into their Google account. If not sent, the user will only be prompted the first time your project requests access. <br />Choose one of the following options:
		- `none`: Do not display any authentication or consent screens. Must not be specified with other values.
		- `consent`: Prompt the user for consent. 
		- `select_account`: Prompt the user to select an account.
- `state`:
	- Type: `string`.
	- `Optional`.
	- A unique string value of your choice that is hard to guess. Used to prevent [CSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery).

#### Authentication Flow
After the completion of the Google OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`googleAuth` method provides 3 set key data:
- `token`:
 	-  Access token to make requests to the google API for retrieving user information and performing actions on their behalf.
	- Type: 
		```
		{
		  token: string
		  expires_in: number
		}
		```
- `granted-scopes`:
	- If the `include_granted_scopes` parameter was set to `true`, you can find here the scopes for which the user has granted permissions.
	 - Type: `string[]`.
- `user-google`:
	- User basic info retrieved from Google
	- Type: 
		```
		{
		  id:  string
		  email:  string
		  verified_email:  boolean
		  name:  string
		  given_name:  string
		  family_name:  string
		  picture:  string
		  locale:  string
		}
		```

To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.
```
app.get(
  '/google',
  (c) => {
    const  token  =  c.get('token')
		const  grantedScopes  =  c.get('granted-scopes')
		const  user  =  c.get('user-google')

		return  c.json({
			token,
			grantedScopes,
			user
		})
  }
)
```
### Revoke Token
In certain use cases, you may need to programmatically revoke a user's access token. In such scenarios, you can utilize the `revokeToken` method, which accepts the `token` to be revoked as its unique parameter.

```
import { googleAuth, revokeToken } from  '@hono/google-auth'

app.post('/remove-user',
  async (c, next) => {
    await  revokeToken(USER_TOKEN)
    
    ...
  }
)
```

## Author
monoald https://github.com/monoald

## License
MIT

## Contribute
If you want to add new features or solve some bugs don't doubt to create an issue or make a PR.
