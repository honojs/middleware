import bots from './robots.json' with { type: 'json' }

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
})
