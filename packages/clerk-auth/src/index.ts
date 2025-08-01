export { getAuth, clerkMiddleware } from './clerk-auth'
import type { ClerkAuthVariables } from './clerk-auth'
export { ClerkAuthVariables }

declare module 'hono' {
  interface ContextVariableMap extends ClerkAuthVariables {}
}
