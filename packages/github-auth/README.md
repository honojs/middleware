# Github Auth Middleware
Authentication middleware for [Hono](https://github.com/honojs/hono). This package offers a straightforward API for Github login.

## Usage
On the Github App or Oauth App (Acccording to your app type) platform add the **Callback uri**. This middleware handles the redirect uri internally as the route you are using the middleware on, so if you decide to use the middleware on the route `/api/v1/auth/github/` the redirect uri will be `DOMAIN/api/v1/auth/github`.
```
app.use(
  "api/v1/auth/github", // -> redirect_uri by default
  githubAuth({ ... })
)
```

Also, there is two ways to use this middleware:
```
app.use(
	'/github',
	githubAuth({ ... })
)

app.get(
	'/github',
	(c) => {
		// Handle authentication
	}
)

export default app
```

Or 
```
app.get(
	'/github',
	githubAuth({ ... }),
	(c) => {
		// Handle authentication
	}
)

export default app

```

### githubAuth
GitHub provides two types of Apps to utilize its API: the `GitHub App` and the `OAuth App`. To understand the differences between these apps, you can read this [article](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app) from GitHub, helping you determine the type of App you should select.

#### Parameters
- `client_id`:
 	- Type: `string`.
	- `Required`.
	- `Github App` and `Oauth App`.
	-  Your app client ID. You can find this value in the [GitHub App settings](https://github.com/settings/apps) or the [OAuth App settings](https://github.com/settings/developers) based on your App type. <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GITHUB_ID=`.
- `client_secret`:
	- Type: `string`.
	- `Required`.
	- `Github App` and `Oauth App`.
	- Your app client secret. You can find this value in the [GitHub App settings](https://github.com/settings/apps) or the [OAuth App settings](https://github.com/settings/developers) based on your App type. <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GITHUB_SECRET=`.
	> Do not share your client secret to ensure the security of your app.
- `scope`:
	- Type: `string[]`.
	- `Required`.
	- `Oauth App`.
	- Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Github offers for utilizing their API on the [Permissions page](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps). <br />For `GitHub Apps`, you select the scopes during the App creation process or in the [settings](https://github.com/settings/apps).
- `oauthApp`:
	- Type: `boolean`.
	- `Required`.
	- `Oauth App`.
	- Set this value to `true` if your App is of the OAuth App type. Defaults to `false`.
#### Authentication Flow
After the completion of the Github Auth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`githubAuth` method provides 4 set key data:
- `token`:
 	-  Access token to make requests to the Github API for retrieving user information and performing actions on their behalf.
	- Type: 
		```
		{
		  token: string
		  expires_in: number // -> only available for Oauth Apps
		}
		```
- `refresh-token`:
	- You can refresh new tokens using this token, which has a longer lifespan. Only available for Oauth Apps.
	 - Type: 
		```
		{
		  token: string
		  expires_in: number
		}
		```
- `user-github`:
	- User basic info retrieved from Github
	- Type: 
		```
		{
		  login:  string
		  id:  number
		  node_id:  string
		  avatar_url:  string
		  gravatar_id:  string
		  url:  string
		  html_url:  string
		  followers_url:  string
		  following_url:  string
		  gists_url:  string
		  starred_url:  string
		  subscriptions_url:  string
		  organizations_url:  string
		  repos_url:  string
		  events_url:  string
		  received_events_url:  string
		  type:  string
		  site_admin:  boolean
		  name:  string
		  company:  string
		  blog:  string
		  location:  string
		  email:  string  |  null
		  hireable:  boolean  |  null
		  bio:  string
		  twitter_username:  string
		  public_repos:  number
		  public_gists:  number
		  followers:  number
		  following:  number
		  created_at:  string
		  updated_at:  string
		  private_gists:  number, // -> Github App
		  total_private_repos:  number, // -> Github App
		  owned_private_repos:  number, // -> Github App
		  disk_usage:  number, // -> Github App
		  collaborators:  number, // -> Github App
		  two_factor_authentication:  boolean, // -> Github App
		  plan: {
		    name:  string,
		    space:  number,
		    collaborators:  number,
		    private_repos:  number
		  } // -> Github App
		}
		```
- `granted-scopes`:
	- If the `include_granted_scopes` parameter was set to `true`, you can find here the scopes for which the user has granted permissions.
#### Github App Example
```
import { Hono } from  'hono'
import { GithubuthVariables, githubAuth } from  '@hono/github-auth'

const  app  =  new  Hono<{ Variables:  GithubAuthVariables }>()

app.use(
  '/github',
  githubAuth({
    client_id:  Bun.env.GITHUB_ID,
    client_secret:  Bun.env.GITHUB_SECRET,
  })
)

app.get(
  '/github',
  (c) => {
    const  token  =  c.get('token')
		const  user  =  c.get('user-github')

		return  c.json({
			token,
			user
		})
  }
)

export  default  app
```

#### OAuth App Example
```
import { Hono } from  'hono'
import { OpenAuthVariables } from  '@hono/open-auth'
import { githubAuth } from  '@hono/open-auth/github'

const  app  =  new  Hono<{ Variables:  OpenAuthVariables }>()

app.use(
  '/github',
  githubAuth({
    client_id:  Bun.env.GITHUB_ID,
    client_secret:  Bun.env.GITHUB_SECRET,
		scope: ['public_repo', 'read:user', 'user', 'user:email', 'user:follow'],
  	oauthApp: true
  })
)

app.get(
  '/github',
  (c) => {
    const  token  =  c.get('token')
    const  refreshToken  =  c.get('refresh-token')
		const  user  =  c.get('user-github')

		return  c.json({
			token,
			refreshToken,
			user
		})
  }
)

export  default  app
```


## Author
monoald https://github.com/monoald

## License
MIT

## Contribute
If you want to add new features or solve some bugs don't doubt to create an issue or make a PR.