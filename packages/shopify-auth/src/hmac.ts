/**
 * Verify a Shopify webhook signature using Web Crypto.
 *
 * @param rawBody the exact request body bytes Shopify signed
 * @param hmacHeader value of the `X-Shopify-Hmac-Sha256` header (base64)
 * @param secret the app's API secret
 *
 * @see https://shopify.dev/docs/apps/build/webhooks/subscribe/https
 */
export async function verifyShopifyHmac(
  rawBody: ArrayBuffer,
  hmacHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!hmacHeader || !secret) {
    return false
  }

  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = Uint8Array.from(atob(hmacHeader), (char) => char.charCodeAt(0))
  } catch {
    return false
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  return crypto.subtle.verify('HMAC', key, signature, rawBody)
}
