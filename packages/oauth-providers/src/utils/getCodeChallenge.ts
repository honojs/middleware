import { base64UrlEncode } from './base64UrlEncode'

type Challenge = {
  codeVerifier: string
  codeChallenge: string
}

export async function getCodeChallenge(): Promise<Challenge> {
  const codeVerifier = generateCodeVerifier()

  const encoder = new TextEncoder()
  const encoded = encoder.encode(codeVerifier)
  const shaEncoded = await crypto.subtle.digest('SHA-256', encoded)
  const codeChallenge = base64UrlEncode(new Uint8Array(shaEncoded))

  return { codeVerifier, codeChallenge }
}

// RFC 7636 7.1 requires a CSPRNG. 32 random bytes encode to 43 base64url
// characters, the minimum length the spec allows.
function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}
