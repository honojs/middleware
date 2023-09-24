import type { SwaggerOptions } from '..'

type BuildUIConfig = {
  domId: string
} & SwaggerOptions

export const buildUIScript = (config: BuildUIConfig): string => {
  const { domId, ...rest } = config
  const params = {
    ...rest,
    dom_id: `#${domId}`,
  }

  return `
    window.onload = () => {
      window.ui = SwaggerUIBundle(${JSON.stringify(params)});
    };
  `
}
