# Stytch Auth Middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=stytch-auth)](https://codecov.io/github/honojs/middleware)

A third-party [Stytch](https://stytch.com) authentication middleware for [Hono](https://github.com/honojs/hono). Supports both [Consumer](https://stytch.com/b2c) and [B2B](https://stytch.com/b2b) authentication with flexible configuration options.

> 💡 This package works with [Stytch Frontend SDKs](https://stytch.com/docs/guides/sessions/frontend-guide) and validates sessions they create. By default, it reads JWTs from the `stytch_session_jwt` cookie. See the [Session JWTs guide](https://stytch.com/docs/guides/sessions/using-jwts) for more details.

## Quick Start

The fastest way to get started with Consumer authentication:

```ts
import { Hono } from 'hono'
import { Consumer } from '@hono/stytch-auth'

const app = new Hono()

// Authenticate all routes
app.use('*', Consumer.authenticateSessionLocal())

app.get('/', (c) => {
  const session = Consumer.getStytchSession(c)
  return c.json({ message: `Hello ${session.user_id}!` })
})

export default app
```

## Installation

```bash
npm install hono @hono/stytch-auth stytch
```

## Configuration

Set these environment variables before using the middleware:

```bash
STYTCH_PROJECT_ID=project-live-xxx-xxx-xxx
STYTCH_PROJECT_SECRET=secret-live-xxx-xxx-xxx
```

## Table of Contents
- [Consumer Authentication](#consumer-authentication)
  - [Basic Session Auth](#basic-consumer-session-auth)
  - [OAuth Bearer Token Auth](#consumer-oauth-auth)
  - [Custom Configuration](#consumer-custom-configuration)
  - [Error Handling](#consumer-error-handling)
- [B2B Authentication](#b2b-authentication)
  - [Basic Session Auth](#basic-b2b-session-auth)
  - [OAuth Bearer Token Auth](#b2b-oauth-auth)
  - [Organization Access](#b2b-organization-access)
  - [Custom Configuration](#b2b-custom-configuration)
  - [Error Handling](#b2b-error-handling)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)

## Consumer Authentication

### Basic Consumer Session Auth

**Local Authentication** (JWT validation only - fastest):

```ts
import { Consumer } from '@hono/stytch-auth'

// Validates JWT locally using cached JWKS
app.use('*', Consumer.authenticateSessionLocal())

app.get('/profile', (c) => {
  const session = Consumer.getStytchSession(c)
  return c.json({ sessionId: session.session_id })
})
```

**Remote Authentication** (validates with Stytch servers - more data):

```ts
import { Consumer } from '@hono/stytch-auth'

// Always calls Stytch servers, returns user data
app.use('*', Consumer.authenticateSessionRemote())

app.get('/profile', (c) => {
  const session = Consumer.getStytchSession(c)
  const user = Consumer.getStytchUser(c)
  return c.json({ 
    sessionId: session.session_id,
    userId: user.user_id 
  })
})
```

### Consumer OAuth Auth

```ts
import { Consumer } from '@hono/stytch-auth'

app.use('*', Consumer.authenticateOAuth())

app.get('/api/data', (c) => {
  const { claims, token } = Consumer.getStytchOAuth(c)
  return c.json({ 
    subject: claims.subject,
    hasValidToken: !!token 
  })
})
```

### Consumer Custom Configuration

**Custom Cookie Name:**

```ts
import { getCookie } from 'hono/cookie'

app.use('*', Consumer.authenticateSessionLocal({
  getCredential: (c) => ({ 
    session_jwt: getCookie(c, 'my_session_cookie') ?? '' 
  })
}))
```

**Custom Token Age:**

```ts
app.use('*', Consumer.authenticateSessionLocal({
  maxTokenAgeSeconds: 60 // 1 minute
}))
```

### Consumer Error Handling

**Redirect to Login:**

```ts
app.use('*', Consumer.authenticateSessionLocal({
  onError: (c, error) => {
    return c.redirect('/login')
  }
}))
```

**Custom Error Response:**

```ts
import { HTTPException } from 'hono/http-exception'

app.use('*', Consumer.authenticateOAuth({
  onError: (c, error) => {
    const errorResponse = new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="api", error="invalid_token"'
      }
    })
    throw new HTTPException(401, { res: errorResponse })
  }
}))
```

## B2B Authentication

### Basic B2B Session Auth

**Local Authentication:**

```ts
import { B2B } from '@hono/stytch-auth'

app.use('*', B2B.authenticateSessionLocal())

app.get('/dashboard', (c) => {
  const session = B2B.getStytchSession(c)
  return c.json({ 
    sessionId: session.member_session_id,
    orgId: session.organization_id 
  })
})
```

**Remote Authentication:**

```ts
import { B2B } from '@hono/stytch-auth'

app.use('*', B2B.authenticateSessionRemote())

app.get('/dashboard', (c) => {
  const session = B2B.getStytchSession(c)
  const member = B2B.getStytchMember(c)
  const organization = B2B.getStytchOrganization(c)
  
  return c.json({ 
    sessionId: session.member_session_id,
    memberEmail: member.email_address,
    orgName: organization.organization_name 
  })
})
```

### B2B OAuth Auth

```ts
import { B2B } from '@hono/stytch-auth'

app.use('*', B2B.authenticateOAuth())

app.get('/api/org-data', (c) => {
  const { claims, token } = B2B.getStytchB2BOAuth(c)
  return c.json({ 
    subject: claims.subject,
    hasValidToken: !!token 
  })
})
```

### B2B Organization Access

After B2B remote authentication, you get access to organization data:

```ts
app.use('*', B2B.authenticateSessionRemote())

app.get('/org-settings', (c) => {
  const organization = B2B.getStytchOrganization(c)
  
  return c.json({
    orgId: organization.organization_id,
    orgName: organization.organization_name,
    // ... other organization fields
  })
})
```

### B2B Custom Configuration

**Organization-Specific Cookie:**

```ts
import { getCookie } from 'hono/cookie'

app.use('*', B2B.authenticateSessionLocal({
  getCredential: (c) => ({ 
    session_jwt: getCookie(c, 'b2b_session_jwt') ?? '' 
  })
}))
```

**Custom API Key Header:**

```ts
app.use('*', B2B.authenticateOAuth({
  getCredential: (c) => ({ 
    access_token: c.req.header('X-B2B-API-Key') ?? '' 
  })
}))
```

### B2B Error Handling

**Redirect to B2B Login:**

```ts
app.use('*', B2B.authenticateSessionLocal({
  onError: (c, error) => {
    return c.redirect('/b2b/login')
  }
}))
```

**Custom B2B Error Response:**

```ts
import { HTTPException } from 'hono/http-exception'

app.use('*', B2B.authenticateOAuth({
  onError: (c, error) => {
    const errorResponse = new Response('B2B Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="b2b-api", error="invalid_token"'
      }
    })
    throw new HTTPException(401, { res: errorResponse })
  }
}))
```

## API Reference

### Consumer Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `Consumer.getClient(c)` | Get Consumer Stytch client | `Client` |
| `Consumer.authenticateSessionLocal(opts?)` | JWT-only auth middleware | `MiddlewareHandler` |
| `Consumer.authenticateSessionRemote(opts?)` | Remote session auth middleware | `MiddlewareHandler` |
| `Consumer.authenticateOAuth(opts?)` | OAuth bearer token middleware | `MiddlewareHandler` |
| `Consumer.getStytchSession(c)` | Get session from context | `Session` |
| `Consumer.getStytchUser(c)` | Get user from context* | `User` |
| `Consumer.getStytchOAuth(c)` | Get OAuth data from context** | `{ claims: ConsumerTokenClaims, token: string }` |

*Only available after `authenticateSessionRemote`  
**Only available after `authenticateOAuth`

### B2B Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `B2B.getClient(c)` | Get B2B Stytch client | `B2BClient` |
| `B2B.authenticateSessionLocal(opts?)` | JWT-only auth middleware | `MiddlewareHandler` |
| `B2B.authenticateSessionRemote(opts?)` | Remote session auth middleware | `MiddlewareHandler` |
| `B2B.authenticateOAuth(opts?)` | B2B OAuth bearer token middleware | `MiddlewareHandler` |
| `B2B.getStytchSession(c)` | Get B2B session from context | `MemberSession` |
| `B2B.getStytchMember(c)` | Get member from context* | `Member` |
| `B2B.getStytchOrganization(c)` | Get organization from context* | `Organization` |
| `B2B.getStytchB2BOAuth(c)` | Get B2B OAuth data from context** | `{ claims: B2BTokenClaims, token: string }` |

*Only available after `authenticateSessionRemote`  
**Only available after `authenticateOAuth`

### Configuration Options

#### Session Authentication Options

```ts
{
  getCredential?: (c: Context) => { session_jwt: string } | { session_token: string },
  maxTokenAgeSeconds?: number, // For local auth only
  onError?: (c: Context, error: Error) => Response | void
}
```

#### OAuth Authentication Options

```ts
{
  getCredential?: (c: Context) => { access_token: string },
  onError?: (c: Context, error: Error) => void
}
```

## Advanced Usage

### Accessing Raw Stytch Clients

For advanced operations, access the underlying Stytch clients:

```ts
// Consumer operations
app.get('/advanced-user-ops', async (c) => {
  const stytchClient = Consumer.getClient(c)
  const { user } = await stytchClient.users.get({ user_id: 'user-123' })
  return c.json({ user })
})

// B2B operations
app.get('/advanced-org-ops', async (c) => {
  const stytchClient = B2B.getClient(c)
  const { organization } = await stytchClient.organizations.get({ 
    organization_id: 'org-123' 
  })
  return c.json({ organization })
})
```

### Multiple Authentication Methods

You can use different auth methods for different routes:

```ts
const app = new Hono()

// Public routes (no auth)
app.get('/health', (c) => c.json({ status: 'ok' }))

// Consumer auth routes
app.use('/consumer/*', Consumer.authenticateSessionLocal())
app.get('/consumer/profile', (c) => {
  const session = Consumer.getStytchSession(c)
  return c.json({ session })
})

// B2B auth routes
app.use('/b2b/*', B2B.authenticateSessionRemote())
app.get('/b2b/dashboard', (c) => {
  const member = B2B.getStytchMember(c)
  const organization = B2B.getStytchOrganization(c)
  return c.json({ member, organization })
})

// OAuth API routes
app.use('/api/*', Consumer.authenticateOAuth())
app.get('/api/data', (c) => {
  const { claims } = Consumer.getStytchOAuth(c)
  return c.json({ subject: claims.subject })
})
```

### Custom Credential Extraction Examples

**From Authorization Header:**
```ts
getCredential: (c) => ({ 
  session_jwt: c.req.header('Authorization')?.replace('Bearer ', '') ?? '' 
})
```

**From Query Parameter:**
```ts
getCredential: (c) => ({ 
  session_jwt: c.req.query('token') ?? '' 
})
```

**From Custom Header:**
```ts
getCredential: (c) => ({ 
  access_token: c.req.header('X-API-Token') ?? '' 
})
```

---

For more information, visit the [Stytch documentation](https://stytch.com/docs) or the [Hono documentation](https://hono.dev/).