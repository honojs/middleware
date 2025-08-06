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
  const outputDirCanonical = outputDir.replace(/^\.\//, '').replace(/\/$/, '')
  let cleanedFile = filePath.replace(/^\.\//, '')
  if (cleanedFile.startsWith(outputDirCanonical + '/')) {
    cleanedFile = cleanedFile.slice(outputDirCanonical.length + 1)
  }
  let routePath = '/' + cleanedFile
  if (routePath.endsWith('/index.html')) {
    routePath = routePath.slice(0, -'index.html'.length) || '/'
  } else if (routePath.endsWith('.html')) {
    routePath = routePath.slice(0, -'.html'.length)
  }
  const canonicalBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  let url: string
  if (cleanedFile.endsWith('index.html')) {
    const dir = cleanedFile.slice(0, -'index.html'.length)
    url = new URL(dir, canonicalBaseUrl).toString()
  } else if (canonicalize && cleanedFile.endsWith('.html')) {
    url = new URL(cleanedFile.slice(0, -'.html'.length), canonicalBaseUrl).toString()
  } else {
    url = new URL(cleanedFile, canonicalBaseUrl).toString()
  }
  return { routePath, url }
}
