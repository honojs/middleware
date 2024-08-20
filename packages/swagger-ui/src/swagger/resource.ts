export interface AssetURLs {
  css: string[];
  js: string[];
}

type ResourceConfig = {
  version?: string;
};

export const remoteAssets = ({ version }: ResourceConfig): AssetURLs => {
  const url = `https://cdn.jsdelivr.net/npm/swagger-ui-dist${
    version !== undefined ? `@${version}` : ""
  }`;

  return {
    css: [`${url}/swagger-ui.css`],
    js: [`${url}/swagger-ui-bundle.js`],
  };
};
