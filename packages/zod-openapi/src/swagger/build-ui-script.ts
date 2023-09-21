import type { OpenAPIObject } from 'openapi3-ts/oas30'

type BuildUIConfig = {
  domId: string
} & (
  | {
      url: string
    }
  | {
      spec: OpenAPIObject
    }
)

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
