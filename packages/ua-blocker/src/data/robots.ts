import robotsJson from './robots.json' with { type: 'json' }

type BotEntry = {
  operator: string
  respect: string
  function: string
  frequency: string
  description: string
}

type BotsList = Record<keyof typeof robotsJson, BotEntry>

/**
 * Raw robots.json data, properly typed
 */
export const bots: BotsList = robotsJson

/**
 * robots.json data as an array of [name, entry] tuples
 */
export const botslist = Object.entries(bots)
