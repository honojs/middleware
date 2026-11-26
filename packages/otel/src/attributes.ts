/**
 * Query parameters whose values the semantic conventions say to replace with
 * `REDACTED` by default.
 *
 * @see https://github.com/open-telemetry/semantic-conventions/blob/v1.45.0/docs/registry/attributes/url.md#url-query
 */
export const DEFAULT_SENSITIVE_QUERY_PARAMETERS: readonly string[] = [
  'X-Amz-Signature',
  'X-Amz-Credential',
  'X-Amz-Security-Token',
  'AWSAccessKeyId',
  'Signature',
  'sig',
  'X-Goog-Signature',
]

/**
 * Replaces the values of sensitive query parameters with `REDACTED`. Keys
 * match case-sensitively. The query comes back untouched when nothing is
 * redacted, and re-encoded by `URLSearchParams` when something is.
 */
export const redactQuery = (query: string, sensitive: ReadonlySet<string>): string => {
  const params = new URLSearchParams()
  let redacted = false
  for (const [key, value] of new URLSearchParams(query)) {
    if (sensitive.has(key)) {
      params.append(key, 'REDACTED')
      redacted = true
    } else {
      params.append(key, value)
    }
  }
  return redacted ? params.toString() : query
}

const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443 }

export const serverPort = (url: URL, scheme: string): number | undefined => {
  if (url.port) {
    return Number(url.port)
  }
  return DEFAULT_PORTS[scheme]
}

// "203.0.113.7:4711" -> "203.0.113.7", "[2001:db8::1]:4711" -> "2001:db8::1".
// A bare IPv6 address is not a valid URL host, so it comes back as is.
const removePort = (address: string): string => {
  try {
    return new URL(`http://${address}`).hostname.replace(/^\[|\]$/g, '')
  } catch {
    return address
  }
}

/**
 * Resolves the original client address from the first entry of the
 * `X-Forwarded-For` header, without its port.
 */
export const clientAddress = (headers: Headers): string | undefined => {
  const address = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return address ? removePort(address) : undefined
}
