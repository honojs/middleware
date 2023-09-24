import type { SwaggerOptions } from '..'

type BuildUIConfig = {
  domId: string
} & SwaggerOptions

export const buildUIScript = (config: BuildUIConfig): string => {
  const params = {
    ...('url' in config ? { url: config.url } : {}),
    ...('spec' in config ? { spec: config.spec } : {}),
    dom_id: `#${config.domId}`,
  }

  return `
    window.onload = () => {
      window.ui = SwaggerUIBundle(${JSON.stringify(params)});
    };
  `
}
