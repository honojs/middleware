import { bots, botslist } from './robots'

describe('Robots data module', () => {
  describe('bots object', () => {
    it('Should be an object', () => {
      expect(typeof bots).toBe('object')
      expect(bots).not.toBeNull()
      expect(Array.isArray(bots)).toBe(false)
    })

    it('Should have bot entries', () => {
      const keys = Object.keys(bots)
      expect(keys.length).toBeGreaterThan(0)
    })

    it('Should have proper structure for each bot entry', () => {
      Object.entries(bots).forEach(([name, entry]) => {
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)

        expect(typeof entry).toBe('object')
        expect(entry).not.toBeNull()

        // Check required properties
        expect(entry).toHaveProperty('operator')
        expect(entry).toHaveProperty('respect')
        expect(entry).toHaveProperty('function')
        expect(entry).toHaveProperty('frequency')
        expect(entry).toHaveProperty('description')

        // Check property types
        expect(typeof entry.operator).toBe('string')
        expect(typeof entry.respect).toBe('string')
        expect(typeof entry.function).toBe('string')
        expect(typeof entry.frequency).toBe('string')
        expect(typeof entry.description).toBe('string')
      })
    })

    it('Should have valid respect values', () => {
      Object.entries(bots).forEach(([, entry]) => {
        expect(entry.respect).toBeDefined()
        expect(entry.respect.length).toBeGreaterThan(0)
      })
    })
  })

  describe('botslist array', () => {
    it('Should be an array', () => {
      expect(Array.isArray(botslist)).toBe(true)
    })

    it('Should have entries', () => {
      expect(botslist.length).toBeGreaterThan(0)
    })

    it('Should contain tuples of [name, entry]', () => {
      botslist.forEach((item) => {
        expect(Array.isArray(item)).toBe(true)
        expect(item.length).toBe(2)

        const [name, entry] = item
        expect(typeof name).toBe('string')
        expect(typeof entry).toBe('object')
        expect(entry).not.toBeNull()
      })
    })

    it('Should have same length as bots object', () => {
      expect(botslist.length).toBe(Object.keys(bots).length)
    })

    it('Should contain all entries from bots object', () => {
      const botslistNames = botslist.map(([name]) => name)
      const botsKeys = Object.keys(bots)

      expect(botslistNames.sort()).toEqual(botsKeys.sort())
    })

    it('Should have matching entries between botslist and bots object', () => {
      botslist.forEach(([name, entry]) => {
        expect(bots).toHaveProperty(name)
        expect(bots[name as keyof typeof bots]).toEqual(entry)
      })
    })
  })
})
