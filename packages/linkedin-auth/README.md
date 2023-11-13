# Linkedin Auth Middleware
Authentication middleware for [Hono](https://github.com/honojs/hono). This package offers a straightforward API for Linkedin login.

## Usage
In your Linkedin Developer App settings add the **Redirect uri**. Linkedin Auth handles the redirect uri internally as the route you are using the middleware on, so if you decide to use the middleware on the route `/api/v1/auth/linkedin/` the redirect uri will be `DOMAIN/api/v1/auth/linkedin`.
```
app.use(
  "api/v1/auth/linkedin", // -> redirect_uri by default
  linkedinAuth({ ... })
)
```

Also, there is two ways to use this middleware:
```
app.use(
	'/linkedin',
	linkedinAuth({ ... })
)

app.get(
	'/linkedin',
	(c) => {
		// Handle authentication
	}
)

export default app
```

Or 
```
app.get(
	'/linkedin',
	linkedinAuth({ ... }),
	(c) => {
		// Handle authentication
	}
)

export default app

```

### linkedinAuth
Linkedin provides two types of Authorization to utilize its API: the `Member Authotization` and the `Application Authorization`. To understand the differences between these authorization methods, you can read this [article](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication?context=linkedin%2Fcontext) from Linkedin, helping you determine the type of Authorization your app should use.

#### Parameters
- `client_id`:
 	- Type: `string`.
	- `Required`.
	- `Member` and `Application` authorization.
	-  Your app client ID. You can find this value in the [Linkedin Developer Portal](https://www.linkedin.com/developers/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `LINKEDIN_ID=`.
- `client_secret`:
	- Type: `string`.
	- `Required`.
	- `Member` and `Application` authorization.
	- Your app client secret. You can find this value in the [Linkedin Developer Portal](https://www.linkedin.com/developers/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `LINKEDIN_SECRET=`.
	> Do not share your client secret to ensure the security of your app.
- `scope`:
	- Type: `string[]`.
	- `Required`.
	- `Member Authorization`.
	- Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Linkedin offers for utilizing their API on the [Getting Access docs page](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access).
 - `state`:
	- Type: `string`.
	- `Required`.
	- A unique string value of your choice that is hard to guess. Used to prevent [CSRF](http://en.wikipedia.org/wiki/Cross-site_request_forgery).
- `AppAuth`:
	- Type: `boolean`.
	- `Required`.
	- `Application Authorization`.
	- Set this value to `true` if your App uses the App Authorization method. Defaults to `false`.
> To access the Application Authorization method you have to ask Linkedin for It. Apparently you have to verify your app then ask for access.
#### Authentication Flow
After the completion of the Linkedin Auth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`linkedinAuth` method provides 4 set key data:
- `token`:
 	-  Access token to make requests to the Linkedin API for retrieving user information and performing actions on their behalf.
	- Type: 
		```
		{
		  token: string
		  expires_in: number
		}
		```
- `refresh-token`:
	- You can refresh new tokens using this token, which has a longer lifespan. Only available for Member Authorization.
	 - Type: 
		```
		{
		  token: string
		  expires_in: number
		}
		```
- `user-linkedin`:
	- User basic info retrieved from Linkedin.
	- Type: 
		```
		{
		  sub:  string
		  email_verified:  boolean
		  name:  string
		  locale: {
		    country:  string
		    language:  string
		  },
		  given_name:  string
		  family_name:  string
		  email:  string
		  picture:  string
		}
		```
		> Only available for Member Authorization.
- `granted-scopes`:
	- If the `include_granted_scopes` parameter was set to `true`, you can find here the scopes for which the user has granted permissions.
#### Member Authentication Example
```
import { Hono } from  'hono'
import { LinkedinAuthVariables, linkedinAuth } from  '@hono/linkedin-auth'

const  app  =  new  Hono<{ Variables:  LinkedinAuthVariables }>()

app.use(
  '/linkedin',
  linkedinAuth({
    client_id:  Bun.env.LINKEDIN_ID,
    client_secret:  Bun.env.LINKEDIN_SECRET,
    scope: ['email', 'openid', 'profile'],
		state: 'blabla',
  })
)

app.get(
  '/linkedin',
  (c) => {
    const  token  =  c.get('token')
		const  user  =  c.get('user-linkedin')

		return  c.json({
			token,
			user
		})
  }
)

export  default  app
```

#### Application Example
```
import { Hono } from  'hono'
import { LinkedinAuthVariables, linkedinAuth } from  '@hono/linkedin-auth'

const  app  =  new  Hono<{ Variables:  LinkedinAuthVariables }>()

app.use(
  '/linkedin',
  linkedinAuth({
    client_id:  Bun.env.LINKEDIN_ID,
    client_secret:  Bun.env.LINKEDIN_SECRET,
  })
)

app.get(
  '/linkedin',
  (c) => {
    const  token  =  c.get('token')

		return  c.json(token)
  }
)

export  default  app
```
### Revoke Token
In certain use cases, you may need to programmatically revoke a user's access token. In such scenarios, you can utilize the `revokeToken` method.

**Parameters**:

- `client_id`: 
	- `string`.
- client_secret: 
	- `string`.
- `refresh_token`:
	- `string`.

**Return Value**:
- `token`:
	- `string`.

```
import { linkedinAuth, refreshToken } from  'open-auth/linkedin'

app.post('linkedin/refresh-token',
  async (c, next) => {
		const  token  =  await  refreshToken(LINKEDIN_ID, LINKEDIN_SECRET, USER_REFRESH_TOKEN)
    
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