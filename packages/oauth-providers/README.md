# OAuth Providers Middleware

Authentication middleware for [Hono](https://github.com/honojs/hono). This package offers a straightforward API for social login with platforms such as Facebook, GitHub, Google, LinkedIn and X(Twitter).

## Installation

You can install `hono` and `@hono/oauth-providers` via npm.

```txt
npm i hono @hono/oauth-providers
```

## Usage

Open Auth simplifies the OAuth2 flow, enabling you to utilize social login with just a single method.
On every platform you choose to add to your project you have to add on its platform the **callback uri** or **redirect uri**. Open Auth handles the redirect uri internally as the route you are using the middleware on, so if you decide to use the google auth on the route `/api/v1/auth/google/` the redirect uri will be `DOMAIN/api/v1/auth/google`.

```ts
app.use(
  "api/v1/auth/google", // -> redirect_uri by default
  googleAuth({ ... })
)
```

Also, there is two ways to use this middleware:

```ts
app.use(
  '/google',
  googleAuth({
    client_id: Bun.env.GOOGLE_ID,
    client_secret: Bun.env.GOOGLE_SECRET,
    scope: ['openid', 'email', 'profile'],
  })
)

app.get('/google', (c) => {
  const token = c.get('token')
  const grantedScopes = c.get('granted-scopes')
  const user = c.get('user-google')

  return c.json({
    token,
    grantedScopes,
    user,
  })
})

export default app
```

Or

```ts
app.get(
  '/google',
  googleAuth({
    client_id: Bun.env.GOOGLE_ID,
    client_secret: Bun.env.GOOGLE_SECRET,
    scope: ['openid', 'email', 'profile'],
  }),
  (c) => {
    const token = c.get('token')
    const grantedScopes = c.get('granted-scopes')
    const user = c.get('user-google')

    return c.json({
      token,
      grantedScopes,
      user,
    })
  }
)

export default app
```

### Google

```ts
import { Hono } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'

const app = new Hono()

app.use(
  '/google',
  googleAuth({
    client_id: Bun.env.GOOGLE_ID,
    client_secret: Bun.env.GOOGLE_SECRET,
    scope: ['openid', 'email', 'profile'],
  })
)

export default app
```

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - Your app client ID. You can find this value in the API Console [Credentials page](https://console.developers.google.com/apis/credentials). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GOOGLE_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - Your app client secret. You can find this value in the API Console [Credentials page](https://console.developers.google.com/apis/credentials). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GOOGLE_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
- `scope`:
  - Type: `string[]`.
  - `Required`.
  - Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Google offers for utilizing their API on the [OAuth 2.0 Scopes page](https://developers.google.com/identity/protocols/oauth2/scopes).
    > If your app is not **verified** by Google, the accessible scopes for your app are significantly **limited**.
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

#### Authentication Flow

After the completion of the Google OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`googleAuth` method provides 3 set key data:

- `token`:
  - Access token to make requests to the google API for retrieving user information and performing actions on their behalf.
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
      id: string
      email: string
      verified_email: boolean
      name: string
      given_name: string
      family_name: string
      picture: string
      locale: string
    }
    ```

To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.

```ts
app.get('/google', (c) => {
  const token = c.get('token')
  const grantedScopes = c.get('granted-scopes')
  const user = c.get('user-google')

  return c.json({
    token,
    grantedScopes,
    user,
  })
})
```

#### Revoke Token

In certain use cases, you may need to programmatically revoke a user's access token. In such scenarios, you can utilize the `revokeToken` method, which accepts the `token` to be revoked as its unique parameter.

```ts
import { googleAuth, revokeToken } from '@hono/oauth-providers/google'

app.post('/remove-user', async (c, next) => {
  await revokeToken(USER_TOKEN)

  // ...
})
```

### Facebook

```ts
import { Hono } from 'hono'
import { facebookAuth } from '@hono/oauth-providers/facebook'

const app = new Hono()

app.use(
  '/facebook',
  facebookAuth({
    client_id: Bun.env.FACEBOOK_ID,
    client_secret: Bun.env.FACEBOOK_SECRET,
    scope: ['email', 'public_profile'],
    fields: [
      'email',
      'id',
      'first_name',
      'last_name',
      'middle_name',
      'name',
      'picture',
      'short_name',
    ],
  })
)

export default app
```

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - Your app client ID. You can find this value in the App Dashboard [Dashboard page](https://developers.facebook.com/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `FACEBOOK_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - Your app client secret. You can find this value in the App Dashboard [Dashboard page](https://developers.facebook.com/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `FACEBOOK_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
- `scope`:
  - Type: `string[]`.
  - `Required`.
  - Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Facebook offers for utilizing their API on the [Permissions page](https://developers.facebook.com/docs/permissions/).
    > If your app is not **verified** by Facebook, the accessible scopes for your app are significantly **limited**.
- `fields`:
  - Type: `string[]`.
  - Fields you request from the Facebook API to be sent once the user has logged in. You can find a comprehensive reference for all the fields you can request on the [Facebook User Reference page](https://developers.facebook.com/docs/graph-api/reference/user/#fields).

#### Authentication Flow

After the completion of the Facebook OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`facebookAuth` method provides 3 set key data:

- `token`:
  - Access token to make requests to the Facebook API for retrieving user information and performing actions on their behalf. It has a duration of 60 days.
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
      id: string
      name: string
      email: string
      picture: {
        data: {
          height: number
          is_silhouette: boolean
          url: string
          width: number
        }
      }
      first_name: string
      last_name: string
      short_name: string
    }
    ```

To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.

```ts
app.get('/facebook', (c) => {
  const token = c.get('token')
  const grantedScopes = c.get('granted-scopes')
  const user = c.get('user-facebook')

  return c.json({
    token,
    grantedScopes,
    user,
  })
})
```

### GitHub

GitHub provides two types of Apps to utilize its API: the `GitHub App` and the `OAuth App`. To understand the differences between these apps, you can read this [article](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app) from GitHub, helping you determine the type of App you should select.

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - `Github App` and `Oauth App`.
  - Your app client ID. You can find this value in the [GitHub App settings](https://github.com/settings/apps) or the [OAuth App settings](https://github.com/settings/developers) based on your App type. <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GITHUB_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - `Github App` and `Oauth App`.
  - Your app client secret. You can find this value in the [GitHub App settings](https://github.com/settings/apps) or the [OAuth App settings](https://github.com/settings/developers) based on your App type. <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `GITHUB_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
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
  - Access token to make requests to the Github API for retrieving user information and performing actions on their behalf.
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

```ts
import { Hono } from 'hono'
import { githubAuth } from '@hono/oauth-providers/github'

const app = new Hono()

app.use(
  '/github',
  githubAuth({
    client_id: Bun.env.GITHUB_ID,
    client_secret: Bun.env.GITHUB_SECRET,
  })
)

app.get('/github', (c) => {
  const token = c.get('token')
  const user = c.get('user-github')

  return c.json({
    token,
    user,
  })
})

export default app
```

#### OAuth App Example

```ts
import { Hono } from 'hono'
import { githubAuth } from '@hono/oauth-providers/github'

const app = new Hono()

app.use(
  '/github',
  githubAuth({
    client_id: Bun.env.GITHUB_ID,
    client_secret: Bun.env.GITHUB_SECRET,
    scope: ['public_repo', 'read:user', 'user', 'user:email', 'user:follow'],
    oauthApp: true,
  })
)

app.get('/github', (c) => {
  const token = c.get('token')
  const refreshToken = c.get('refresh-token')
  const user = c.get('user-github')

  return c.json({
    token,
    refreshToken,
    user,
  })
})

export default app
```

### LinkedIn

LinkedIn provides two types of Authorization to utilize its API: the `Member Authotization` and the `Application Authorization`. To understand the differences between these authorization methods, you can read this [article](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication?context=linkedin%2Fcontext) from LinkedIn, helping you determine the type of Authorization your app should use.

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - `Member` and `Application` authorization.
  - Your app client ID. You can find this value in the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `LINKEDIN_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - `Member` and `Application` authorization.
  - Your app client secret. You can find this value in the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `LINKEDIN_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
- `scope`:
  - Type: `string[]`.
  - `Required`.
  - `Member Authorization`.
  - Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes LinkedIn offers for utilizing their API on the [Getting Access docs page](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access).
- `appAuth`: - Type: `boolean`. - `Required`. - `Application Authorization`. - Set this value to `true` if your App uses the App Authorization method. Defaults to `false`.
  > To access the Application Authorization method you have to ask LinkedIn for It. Apparently you have to verify your app then ask for access.

#### Authentication Flow

After the completion of the LinkedIn Auth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`linkedinAuth` method provides 4 set key data:

- `token`:
  - Access token to make requests to the LinkedIn API for retrieving user information and performing actions on their behalf.
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
  - User basic info retrieved from LinkedIn.
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

```ts
import { Hono } from 'hono'
import { linkedinAuth } from '@hono/oauth-providers/linkedin'

const app = new Hono()

app.use(
  '/linkedin',
  linkedinAuth({
    client_id: Bun.env.LINKEDIN_ID,
    client_secret: Bun.env.LINKEDIN_SECRET,
    scope: ['email', 'openid', 'profile'],
  })
)

app.get('/linkedin', (c) => {
  const token = c.get('token')
  const user = c.get('user-linkedin')

  return c.json({
    token,
    user,
  })
})

export default app
```

#### Application Example

```ts
import { Hono } from 'hono'
import { linkedinAuth } from '@hono/oauth-providers/linkedin'

const app = new Hono()

app.use(
  '/linkedin',
  linkedinAuth({
    client_id: Bun.env.LINKEDIN_ID,
    client_secret: Bun.env.LINKEDIN_SECRET,
    appAuth: true,
  })
)

app.get('/linkedin', (c) => {
  const token = c.get('token')

  return c.json(token)
})

export default app
```

#### Revoke Token

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

```ts
import { linkedinAuth, refreshToken } from '@hono/oauth-providers/linkedin'

app.post('linkedin/refresh-token', async (c, next) => {
  const token = await refreshToken(LINKEDIN_ID, LINKEDIN_SECRET, USER_REFRESH_TOKEN)

  // ...
})
```

### X (Twitter)

```ts
import { Hono } from 'hono'
import { xAuth } from '@hono/oauth-providers/x'

const app = new Hono()

app.use(
  '/x',
  xAuth({
    client_id: Bun.env.X_ID,
    client_secret: Bun.env.X_SECRET,
    scope: ['tweet.read', 'users.read', 'offline.access'],
    fields: ['profile_image_url', 'url'],
  })
)

export default app
```

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - Your app client ID. You can find this value in the [Developer Portal](https://developer.twitter.com/en/portal/dashboard). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `X_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - Your app client secret. You can find this value in the [Developer Portal](https://developer.twitter.com/en/portal/dashboard). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `X_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
- `scope`:
  - Type: `string[]`.
  - `Required`.
  - Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes X(Twitter) offers for utilizing their API on the [Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code). <br />If not sent the default fields x set are `id`, `name` and `username.`
- `fields`:
  - Type: `string[]`.
  - `Optional`.
  - Set of **fields** of the user information that can be retreived from X. Check All the fields available on the [get user me reference](https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference/get-users-me).

#### Authentication Flow

After the completion of the X OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`xAuth` method provides 4 set key data:

- `token`:
  - Access token to make requests to the x API for retrieving user information and performing actions on their behalf.
  - Type:
    ```
    {
      token: string
      expires_in: number
    }
    ```
- `refresh-token`:
  - You can refresh new tokens using this token. The duration of this token is not specified on the X docs.
  - Type:
    ```
    {
      token: string
      expires_in: number
    }
    ```
- `granted-scopes`:
  - Scopes for which the user has granted permissions.
  - Type: `string[]`.
- `user-x`:
  - User basic info retrieved from X
  - Type:
    ```
    {
      created_at: string
    	description: string
    	entities: {
    		url: {
    			urls: {
    				start: number
    				end: number
    				url: string
    				expanded_url: string
    				display_url: string
    			}
    		}
    	}
    	id: string
    	location: string
    	most_recent_tweet_id: string
    	name: string
    	profile_image_url: string
    	protected: boolean
    	public_metrics: {
    		followers_count: number
    		following_count: number
    		tweet_count: number
    		listed_count: number
    		like_count: number
    	}
    	url: string
    	username: string
    	verified_type: string
    	verified: boolean
    }
    ```

> If you want to receive the **refresh token** you must add the `offline.access` in the scopes parameter.
> To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.

```ts
app.get('/x', (c) => {
  const token = c.get('token')
  const refreshToken = c.get('refresh-token')
  const grantedScopes = c.get('granted-scopes')
  const user = c.get('user-x')

  return c.json({
    token,
		refreshToken
    grantedScopes,
    user,
  })
})
```

#### Refresh Token

Once the user token expires you can refresh their token wihtout the need to prompt the user again for access. In such scenario, you can utilize the `refreshToken` method, which accepts the `client_id`, `client_secret` and `refresh_token` as parameters.

> The `refresh_token` can be used once. Once the token is refreshed X gives you a new `refresh_token` along with the new token.

```ts
import { xAuth, refreshToken } from '@hono/oauth-providers/x'

app.post('/x/refresh', async (c, next) => {
  await refreshToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

  // ...
})
```

#### Revoke Token

In certain use cases, you may need to programmatically revoke a user's access token. In such scenarios, you can utilize the `revokeToken` method, the `client_id`, `client_secret` and the `token` to be revoked as parameters.

It returns a `boolean` to tell whether the token was revoked or not.

```ts
import { xAuth, revokeToken } from '@hono/oauth-providers/x'

app.post('/remove-user', async (c, next) => {
  await revokeToken(CLIENT_ID, CLIENT_SECRET, USER_TOKEN)

  // ...
})
```

### Discord

```ts
import { Hono } from 'hono'
import { discordAuth } from '@hono/oauth-providers/discord'

const app = new Hono()

app.use(
  '/discord',
  discordAuth({
    client_id: Bun.env.DISCORD_ID,
    client_secret: Bun.env.DISCORD_SECRET,
    scope: ['identify', 'email'],
  })
)

export default app
```

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - Your app client ID. You can find this value in the [Developer Portal](https://discord.com/developers/applications). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `DISCORD_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - Your app client secret. You can find this value in the [Developer Portal](https://discord.com/developers/applications). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `DISCORD_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
- `scope`:
  - Type: `string[]`.
  - `Required`.
  - Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Discord offers for utilizing their API on the [Documentation](https://discord.com/developers/docs/reference#api-reference).

#### Authentication Flow

After the completion of the Discord OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`discordAuth` method provides 4 set key data:

- `token`:
  - Access token to make requests to the Discord API for retrieving user information and performing actions on their behalf.
  - Type:
    ```
    {
      token: string
      expires_in: number
    }
    ```
- `refresh-token`:
  - You can refresh new tokens using this token. The duration of this token is not specified on the Discord docs.
  - Type:
    ```
    {
      token: string
      expires_in: number
    }
    ```
        > [!NOTE]
        > The refresh token Discord retrieves no implicit expiration
- `granted-scopes`:
  - Scopes for which the user has granted permissions.
  - Type: `string[]`.
- `user-discord`:
  - User basic info retrieved from Discord
  - Type:
    ```
    {
    	id: string
    	username: string
    	avatar: string
    	discriminator: string
    	public_flags: number
    	premium_type: number
    	flags: number
    	banner: string | null
    	accent_color: string | null
    	global_name: string
    	avatar_decoration_data: string | null
    	banner_color: string | null
    }
    ```

> [!NOTE]
> To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.

```ts
app.get('/discord', (c) => {
  const token = c.get('token')
  const refreshToken = c.get('refresh-token')
  const grantedScopes = c.get('granted-scopes')
  const user = c.get('user-discord')

  return c.json({
    token,
		refreshToken
    grantedScopes,
    user,
  })
})
```

#### Refresh Token

Once the user token expires you can refresh their token wihtout the need to prompt the user again for access. In such scenario, you can utilize the `refreshToken` method, which accepts the `client_id`, `client_secret` and `refresh_token` as parameters.

> [!NOTE]
> The `refresh_token` can be used once. Once the token is refreshed Discord gives you a new `refresh_token` along with the new token.

```ts
import { discordAuth, refreshToken } from '@hono/oauth-providers/discord'

app.post('/discord/refresh', async (c, next) => {
  const newTokens = await refreshToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

  // newTokenes = {
  //   token_type: 'bear',
  //   access_token: 'skbjbfhj3b4348wdvbwje239'
  //   expires_in: 60000
  //   refresh_token: 'sfcb0dwd0hdeh29db'
  //   scope: "identify email"
  // }
  // ...
})
```

#### Revoke Token

In certain use cases, you may need to programmatically revoke a user's access token. In such scenarios, you can utilize the `revokeToken` method, the `client_id`, `client_secret` and the `token` to be revoked as parameters.

It returns a `boolean` to tell whether the token was revoked or not.

```ts
import { discordAuth, revokeToken } from '@hono/oauth-providers/discord'

app.post('/remove-user', async (c, next) => {
  const revoked = await revokeToken(CLIENT_ID, CLIENT_SECRET, USER_TOKEN)

  // revoked = true | false
  // ...
})
```

### Twitch

```ts
import { Hono } from 'hono'
import { twitchAuth } from '@hono/oauth-providers/twitch'

const app = new Hono()

app.use(
  '/twitch',
  twitchAuth({
    client_id: Bun.env.TWITCH_ID,
    client_secret: Bun.env.TWITCH_SECRET,
    scope: ['user:read:email', 'channel:read:subscriptions', 'bits:read'],
    redirect_uri: 'http://localhost:3000/twitch',
  })
)

export default app
```

#### Parameters

- `client_id`:
  - Type: `string`.
  - `Required`.
  - Your app client ID. You can find this value in the [Twitch Developer Portal](https://dev.twitch.tv/console/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `TWITCH_ID=`.
- `client_secret`:
  - Type: `string`.
  - `Required`.
  - Your app client secret. You can find this value in the [Twitch Developer Portal](https://dev.twitch.tv/console/apps). <br />When developing **Cloudflare Workers**, there's no need to send this parameter. Just declare it in the `wrangler.toml` file as `TWITCH_SECRET=`.
    > ⚠️ Do **not** share your **client secret** to ensure the security of your app.
- `scope`:
  - Type: `string[]`.
  - `Required`.
  - Set of **permissions** to request the user's authorization to access your app for retrieving user information and performing actions on their behalf.<br /> Review all the scopes Twitch offers for utilizing their API on the [Twitch API Reference](https://dev.twitch.tv/docs/authentication/scopes).
- `redirect_uri`:
  - Type: `string`.
  - `Required`.
  - The URI to which the user will be redirected after authentication.
- `state`:
  - Type: `string`.
  - `Optional`.
  - A unique string to protect against Cross-Site Request Forgery (CSRF) attacks. The state is passed back to your redirect URI after the user has authenticated. You should verify that the state matches the one you provided in the initial request.
- `force_verify`:
  - Type: `boolean`.
  - `Optional`.
  - Set this value to `true` if you want to force the user to verify their account. Defaults to `false`.

#### Authentication Flow

After the completion of the Twitch OAuth flow, essential data has been prepared for use in the subsequent steps that your app needs to take.

`twitchAuth` method provides 4 set key data:

- `token`:
  - Access token to make requests to the Twitch API for retrieving user information and performing actions on their behalf.
  - Type:
    ```
    {
      token: string
      expires_in: number
    }
    ```
- `refresh-token`:
  - You can refresh new tokens using this token. The duration of this token is not specified on the Twitch docs.
  - Type:
    ```
    {
      token: string
      expires_in: number
    }
    ```
- `granted-scopes`:
  - Scopes for which the user has granted permissions.
  - Type: `string[]`.
- `user-twitch`:
  - User basic info retrieved from Twitch
  - Type:
    ```
    {
      id: string
      login: string
      display_name: string
      type: string
      broadcaster_type: string
      description: string
      profile_image_url: string
      offline_image_url: string
      view_count: number
      email: string
      created_at: string
    }
    ```

> [!NOTE]
> To access this data, utilize the `c.get` method within the callback of the upcoming HTTP request handler.

```ts
app.get('/twitch', (c) => {
  const token = c.get('token')
  const refreshToken = c.get('refresh-token')
  const grantedScopes = c.get('granted-scopes')
  const user = c.get('user-twitch')

  return c.json({
    token,
    refreshToken,
    grantedScopes,
    user,
  })
})
```

#### Refresh Token

Once the user token expires you can refresh their token without the need to prompt the user again for access. In such scenario, you can utilize the `refreshToken` method, which accepts the `client_id`, `client_secret` and `refresh_token` as parameters.

> [!NOTE]
> The `refresh_token` can be used once. Once the token is refreshed Twitch gives you a new `refresh_token` along with the new token.

```ts
import { twitchAuth, refreshToken } from '@hono/oauth-providers/twitch'

app.post('/twitch/refresh', async (c, next) => {
  const newTokens = await refreshToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

  // newTokens = {
  //   token_type: 'bearer',
  //   access_token: 'new-access-token',
  //   expires_in: 60000,
  //   refresh_token: 'new-refresh-token',
  //   scope: ['user:read:email', 'channel:read:subscriptions', 'bits:read']
  // }
  // ...
})
```

#### Revoke Token

In certain use cases, you may need to programmatically revoke a user's access token. In such scenarios, you can utilize the `revokeToken` method, the `client_id` and the `token` to be revoked as parameters.

It returns a `boolean` to tell whether the token was revoked or not.

```ts
import { twitchAuth, revokeToken } from '@hono/oauth-providers/twitch'

app.post('/remove-user', async (c, next) => {
  const revoked = await revokeToken(CLIENT_ID, USER_TOKEN)

  // revoked = true | false
  // ...
})
```

#### Validate Token

You can validate a Twitch access token to verify it's still valid or to obtain information about the token, such as its expiration date, scopes, and the associated user.

You can use `validateToken` method, which accepts the `token` to be validated as parameter and returns `TwitchValidateSuccess` if valid or throws `HTTPException` upon failure.


> **IMPORTANT:** Twitch requires applications to validate OAuth tokens when they start and on an hourly basis thereafter. Failure to validate tokens may result in Twitch taking punitive action, such as revoking API keys or throttling performance. When a token becomes invalid, your app should terminate all sessions using that token immediately. [Read more](https://dev.twitch.tv/docs/authentication/validate-tokens)

The validation endpoint helps your application detect when tokens become invalid for reasons other than expiration, such as when users disconnect your integration from their Twitch account. When a token becomes invalid, your app should terminate all sessions using that token.

> For security and compliance, make sure to implement regular token validation in your application. If a token becomes invalid, promptly sign out the user and terminate their OAuth session.

## Advance Usage

### Customize `redirect_uri`

All the provider middlewares also accept a `redirect_uri` parameter that overrides the default `redirect_uri = c.req.url` behavior.

This parameters can be useful if

1. `hono` process cannot infer correct redirect_uri from the request. For example, when the server runs behind a reverse proxy and have no access to its internet hostname.
2. Or, in need to start oauth flow from a different route.
3. Or, in need to encode more info into `redirect_uri`.

```ts
const app = new Hono();

const SITE_ORIGIN = `https://my-site.com`;
const OAUTH_CALLBACK_PATH = `/oauth/google`;

app.get('/*',
  async (c, next) => {
    const session = readSession(c);
    if (!session) {
      // start oauth flow
      const redirectUri = `${SITE_ORIGIN}${OAUTH_CALLBACK_PATH}?redirect=${encodeURIComponent(c.req.path)}`;
      const oauth = googleAuth({ redirect_uri: redirectUri, ...more });
      return await oauth(c, next)
    }
  },
  async (c, next) => {
    // if we are here, the req should contain either a valid session or a valid auth code
    const session = readSession(c);
    const authedGoogleUser = c.get('user-google')
    if (authedGoogleUser) {
      await saveSession(c, authedGoogleUser);
    } else if (!session) {
      throw new HttpException(401)
    }
    return next();
  },
  async (c, next) => {
    // serve protected content
  }
);
```

## Author

monoald https://github.com/monoald

## License

MIT

## Contribute

If you want to add new providers, features or solve some bugs don't doubt to create an issue or make a PR.

For testing purposes run the following code in the parent folder (`middleware/`):
