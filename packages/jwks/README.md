# jwks middleware for Hono

Using [`jose`](https://github.com/panva/jose) to verify JWT based on a public key from a JWKS endpoint.

## Installation

```bash
npm i hono @hono/jwks jose
```

## Configuration

The `jwks` middleware has the following options:

```ts
  certsUrl: string | URL // The URL to the JWKS endpoint
  policyIssuer: string // The issuer of the policy (iss claim)
  policyAudience: string // The audience of the policy (aud claim)
  tokenSource?: (c: Context) => string | undefined // A optional function to get the token from the context. Defaults to the cloudflare header
  headerName?: string // The header name to get the token from. Defaults to 'cf-access-jwt-assertion'
```

## Usage

### Output

If it is a valid JWT, the middleware will inject the decoded payload into the `Context` and will be available in the `jwks` variable with the following structure:

```ts
  payload: any // The decoded JWT payload
  token: any // The token string used to verify the JWT
```

If the token is not found in the provided source, the middleware will throw an error with the status code `403` and the message `Forbidden`.

If token is unable to be verified, the middleware will throw an error with the status code `401` and the message `Unauthorized`.

### Cloudflare Workers and Cloudflare Zero Trust Example

```ts
import { hello } from '@hono/jwks'
import { Hono } from 'hono'

const app = new Hono<{Binding: { TEAM_NAME: string, POLICY_AUD: string }}>()

app.use((c, next) => {
  // Set the TEAM_NAME and POLICY_AUD from the Cloudflare Variables and Secrets
  const { TEAM_NAME, POLICY_AUD } = c.env;

  // The team domain is used to build the JWKS URL and the policy issuer
  const teamDomain = `https://${TEAM_NAME}.cloudflareaccess.com`;

  const jwksWorker = jwks({
    certsUrl: `${teamDomain}/cdn-cgi/access/certs`,
    policyIssuer: teamDomain,
    policyAudience: POLICY_AUD,
  });

  return jwksWorker(c, next);
});

app.get("/test-jwks", (c) => {
  return c.json(c.var.jwks);
});

export default app
```

## Notes

This middleware was built to be used with multiple different providers, such as Cloudflare Zero Trust, but exhaustive testing has not been done. Please open an issue if you find a bug or have a feature request.

## Author

Shawn Carr <https://github.com/shawncarr>

## License

MIT
