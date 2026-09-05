import type { OAuthVariables } from '../../types'
import type { OpenStreetMapUser } from './types'
export { openstreetmapAuth } from './openstreetmapAuth'
export { revokeToken } from './revokeToken'
export * from './types'

declare module 'hono' {
  interface ContextVariableMap extends OAuthVariables {
    'user-openstreetmap': Partial<OpenStreetMapUser> | undefined
  }
}
