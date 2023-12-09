type Challenge = {
  codeVerifier: string
  codeChallenge: string
}

export async function getCodeChallenge(): Promise<Challenge> {
  const codeVerifier = generateRandomString()

  const encoder = new TextEncoder()
  const encoded = encoder.encode(codeVerifier)
  const shaEncoded = await crypto.subtle.digest('SHA-256', encoded)
  const strEncoded = btoa(String.fromCharCode(...new Uint8Array(shaEncoded)))
  const codeChallenge = base64URLEncode(strEncoded)

  return { codeVerifier, codeChallenge }
}

function generateRandomString() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const length = Math.floor(Math.random() * (128 - 43 + 1)) + 43

  const randomString = Array.from({ length }, () => {
    const randomIndex = Math.floor(Math.random() * characters.length)
    return characters.charAt(randomIndex)
  }).join('')

  return randomString
}

function base64URLEncode(str: string) {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
