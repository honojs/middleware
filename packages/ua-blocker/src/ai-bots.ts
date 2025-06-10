import { createMiddleware } from 'hono/factory'
import { ROBOTS_TXT } from './generated'

export {
  ALL_BOTS as aiBots,
  NON_RESPECTING_BOTS as nonRespectingAiBots,
  ROBOTS_TXT as AI_ROBOTS_TXT,
} from './generated'

export function useAiRobotsTxt() {
  return createMiddleware(async (c) => {
    return c.text(ROBOTS_TXT, 200)
  })
}
