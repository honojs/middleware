import CryptoJS from 'crypto-js'

type Challenge = {
  codeVerifier: string
  codeChallenge: string
}

export function getCodeChallenge(): Challenge {
  const codeVerifier = generateRandomString()
  const codeChallenge = base64URLEncode(CryptoJS.SHA256(codeVerifier))

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

function base64URLEncode(str: CryptoJS.lib.WordArray) {
  return str.toString(CryptoJS.enc.Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}