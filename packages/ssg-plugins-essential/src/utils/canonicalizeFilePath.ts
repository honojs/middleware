import path from 'node:path'

/**
 * Converts a generated file path to both a canonicalized URL and a route path.
 *
 * @param filePath - The generated file path (e.g., `./static/about.html`, `static/blog/index.html`).
 * @param outputDir - The output directory used for static files (e.g., `./static`).
 * @param baseUrl - The base URL of the site (e.g., `https://example.com`).
 * @param canonicalize - If true, removes `.html` extension except for `index.html`. Default: `true`.
 * @returns `{ routePath: string, url: string }`
 */
export const canonicalizeFilePath = (
  filePath: string,
  outputDir: string,
  baseUrl: string,
  canonicalize: boolean = true
): { routePath: string; url: string } => {
  const posixFilePath = filePath.replace(/\\/g, '/')
  const posixOutputDir = outputDir.replace(/\\/g, '/')
  const outputDirCanonical = path.posix.resolve(path.posix.normalize(posixOutputDir))
  const filePathResolved = path.posix.resolve(path.posix.normalize(posixFilePath))
  const relativePath = path.relative(outputDirCanonical, filePathResolved)

  let routePath = '/' + relativePath
  if (routePath.endsWith('/index.html')) {
    routePath = routePath.slice(0, -'index.html'.length) || '/'
  } else if (routePath.endsWith('.html')) {
    routePath = routePath.slice(0, -'.html'.length)
  }
  const canonicalBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  let url: string
  if (relativePath.endsWith('index.html')) {
    const dir = relativePath.slice(0, -'index.html'.length)
    url = new URL(dir, canonicalBaseUrl).toString()
  } else if (canonicalize && relativePath.endsWith('.html')) {
    url = new URL(relativePath.slice(0, -'.html'.length), canonicalBaseUrl).toString()
  } else {
    url = new URL(relativePath, canonicalBaseUrl).toString()
  }
  return { routePath, url }
}
