# Facebook Auth Middleware
Authentication middleware for [Hono](https://github.com/honojs/hono). This package offers a straightforward API for Facebook login.

## Usage
In your Meta Developers App settings add the **Redirect uri**. This middleware handles the redirect uri internally as the route you are using the middleware on, so if you decide to use the middleware on the route `/api/v1/auth/facebook/` the redirect uri will be `DOMAIN/api/v1/auth/facebook`.
```
app.use(
  "api/v1/auth/facebook", // -> redirect_uri by default
  facebookAuth({ ... })
)
```

Also, there is two ways to use this middleware:
```
app.use(
	'/facebook',
	facebookAuth({ ... })
)

app.get(
	'/facebook',
	(c) => {
		// Handle authentication
	}
)

export default app
```

Or 
```
app.get(
	'/facebook',
	facebookAuth({ ... }),
	(c) => {
		// Handle authentication
	}
)

export default app

```

### facebookAuth
```
import { Hono } from  'hono'
import { FacebookAuthVariables, facebookAuth } from  '@hono/facebook-auth'

const  app  =  new  Hono<{ Variables:  FacebookAuthVariables }>()

app.use(
  '/facebook',
  facebookAuth({
    client_id:  Bun.env.FACEBOOK_ID,
    client_secret:  Bun.env.FACEBOOK_SECRET,
    response_type: ['token'],
		scope: ['email', 'public_profile'],
		fields: ['email', 'id', 'first_name', 'last_name', 'middle_name', 'name', 'picture', 'short_name'],
		include_granted_scopes:  true
  })
)

export  default  app
```
#### Parameters
- `client_id`:
 	- Type: `string`.
	- `Required`.
	-  Your app client ID. You can find this value in the App Dashboard [Dashboard page](https://developers.facebook.com/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `FACEBOOK_ID=`.
- `client_secret`:
	- Type: `string`.
	- `Required`.
	- Your app client secret. You can find this value in the App Dashboard [Dashboard page](https://developers.facebook.com/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `FACEBOOK_SECRET=`.
	> Do not share your client secret to ensure the security of your app.
- `scope`:
	- Type: `string[]`.
	- `Required`.
	- Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Facebook offers for utilizing their API on the [Permissions page](https://developers.facebook.com/docs/permissions/). 
	> If your app is not **verified** by Facebook, the accessible scopes for your app are significantly **limited**.
- `response_type`:
	- Type: `string[]`.
	- `Required`.
	- Choose the **OAuth flow** for the authentication process. The available options are:
		- `code` for a more secure flow, applicable when the app's authentication flow is managed by the **server side**.
		- `token` for quick access to the token, suitable when the app's authentication flow will be managed by the **client side**.
		- `code%20token`:  A combination of both the code and access token received as parameters on the url.
- `include_granted_scopes`:
	- Type: `boolean`.
	- `Optional`.
	- To obtain the scopes for which the user has **granted permission**, set this value to `true`. This will allow you to implement a flow in cases where your app cannot access crucial permissions and needs to request them again, among other use cases.  Value `false` by default.
- `fields`:
	- Type: `string[]`.
	- Fields you request from the Facebook API to be sent once the user has logged in. You can find a comprehensive reference for all the fields you can request on the [Facebook User Reference page](https://developers.facebook.com/docs/graph-api/reference/user/#fields).
- `state`:
	- Type: `string`.
	- `Optional`.
	- A unique string value of your choice that is hard to guess. Used to prevent [CSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery).

#### Authentication Flow
After the completion of the Facebook OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`facebookAuth` method provides 3 set key data:
- `token`:
 	-  Access token to make requests to the Facebook API for retrieving user information and performing actions on their behalf. It has a duration of 60 days.
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
- `user-facebook`:
	- User basic info retrieved from Facebook
	- Type: 
		```
		{
		  id:  string
		  name:  string
		  email:  string
		  picture: {
		    data: {
		      height:  number
		      is_silhouette:  boolean
		      url:  string
		      width:  number
		    }
		  }
		  first_name:  string
		  last_name:  string
		  short_name:  string
		}
		```

To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.
```
app.get(
  '/facebook',
  (c) => {
    const  token  =  c.get('token')
		const  grantedScopes  =  c.get('granted-scopes')
		const  user  =  c.get('user-facebook')

		return  c.json({
			token,
			grantedScopes,
			user
		})
  }
)
```

## Author
monoald https://github.com/monoald

## License
MIT

## Contribute
If you want to add new features or solve some bugs don't doubt to create an issue or make a PR.
