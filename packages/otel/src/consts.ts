import packageJson from '../package.json' with { type: 'json' }

export const INSTRUMENTATION_SCOPE: { name: string; version: string } = {
  name: packageJson.name,
  version: packageJson.version,
}
