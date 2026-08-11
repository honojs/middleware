import { base64UrlEncode } from './base64UrlEncode'

// The state parameter is the anti-CSRF token of the OAuth flow (RFC 6749 10.12),
// so it has to come from a CSPRNG rather than Math.random().
export function getRandomState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}
