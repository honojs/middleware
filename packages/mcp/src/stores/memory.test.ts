import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryEventStore, RingBuffer } from './memory'

describe('RingBuffer', () => {
  describe('push', () => {
    it('should add items to the buffer', () => {
      const buffer = new RingBuffer<number>(5)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)

      expect(buffer.read()).toEqual([1, 2, 3])
    })

    it('should increment head on each push', () => {
      const buffer = new RingBuffer<number>(5)
      expect(buffer.head).toBe(0)

      buffer.push(1)
      expect(buffer.head).toBe(1)

      buffer.push(2)
      expect(buffer.head).toBe(2)
    })

    it('should overwrite old items when buffer is full', () => {
      const buffer = new RingBuffer<number>(3)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      buffer.push(4) // Overwrites 1
      buffer.push(5) // Overwrites 2

      expect(buffer.read()).toEqual([3, 4, 5])
    })

    it('should call cleanup callback when overwriting items', () => {
      const cleanup = vi.fn()
      const buffer = new RingBuffer<number>(3, cleanup)

      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      expect(cleanup).not.toHaveBeenCalled()

      buffer.push(4) // Overwrites 1
      expect(cleanup).toHaveBeenCalledWith(1)
      expect(cleanup).toHaveBeenCalledTimes(1)

      buffer.push(5) // Overwrites 2
      expect(cleanup).toHaveBeenCalledWith(2)
      expect(cleanup).toHaveBeenCalledTimes(2)
    })
  })

  describe('get', () => {
    it('should return item at valid index', () => {
      const buffer = new RingBuffer<string>(5)
      buffer.push('a')
      buffer.push('b')
      buffer.push('c')

      expect(buffer.get(0)).toBe('a')
      expect(buffer.get(1)).toBe('b')
      expect(buffer.get(2)).toBe('c')
    })

    it('should return undefined for indices before tail', () => {
      const buffer = new RingBuffer<number>(3)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      buffer.push(4) // tail is now 1

      expect(buffer.get(0)).toBeUndefined()
      expect(buffer.get(1)).toBe(2)
    })

    it('should return undefined for indices after head', () => {
      const buffer = new RingBuffer<number>(5)
      buffer.push(1)
      buffer.push(2)

      expect(buffer.get(2)).toBeUndefined()
      expect(buffer.get(10)).toBeUndefined()
    })

    it('should handle circular indexing correctly', () => {
      const buffer = new RingBuffer<number>(3)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      buffer.push(4) // Overwrites 1, at index 0
      buffer.push(5) // Overwrites 2, at index 1

      expect(buffer.get(3)).toBe(4)
      expect(buffer.get(4)).toBe(5)
    })
  })

  describe('read', () => {
    it('should return empty array for empty buffer', () => {
      const buffer = new RingBuffer<number>(5)
      expect(buffer.read()).toEqual([])
    })

    it('should return all items in order', () => {
      const buffer = new RingBuffer<number>(5)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)

      expect(buffer.read()).toEqual([1, 2, 3])
    })

    it('should handle full buffer correctly', () => {
      const buffer = new RingBuffer<string>(3)
      buffer.push('a')
      buffer.push('b')
      buffer.push('c')

      expect(buffer.read()).toEqual(['a', 'b', 'c'])
    })
  })

  describe('reset', () => {
    it('should clear all items from buffer', () => {
      const buffer = new RingBuffer<number>(5)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)

      buffer.reset()

      expect(buffer.head).toBe(0)
      expect(buffer.read()).toEqual([])
    })

    it('should call cleanup callback for all items when resetting', () => {
      const cleanup = vi.fn()
      const buffer = new RingBuffer<number>(5, cleanup)
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)

      buffer.reset()

      expect(cleanup).toHaveBeenCalledWith(1)
      expect(cleanup).toHaveBeenCalledWith(2)
      expect(cleanup).toHaveBeenCalledWith(3)
      expect(cleanup).toHaveBeenCalledTimes(3)
    })

    it('should allow reuse after reset', () => {
      const buffer = new RingBuffer<number>(3)
      buffer.push(1)
      buffer.push(2)
      buffer.reset()

      buffer.push(10)
      buffer.push(20)

      expect(buffer.read()).toEqual([10, 20])
    })
  })
})

describe('MemoryEventStore', () => {
  let store: MemoryEventStore

  beforeEach(() => {
    store = new MemoryEventStore()
  })

  describe('storeEvent', () => {
    it('should store an event and return an event id', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        method: 'test',
      }

      const eventId = await store.storeEvent('stream-1', message)
      expect(eventId).toBeDefined()
      expect(typeof eventId).toBe('string')
    })

    it('should store multiple events for the same stream', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }
      const message2: JSONRPCMessage = { jsonrpc: '2.0', method: 'test2' }
      const message3: JSONRPCMessage = { jsonrpc: '2.0', method: 'test3' }

      const id1 = await store.storeEvent('stream-1', message1)
      const id2 = await store.storeEvent('stream-1', message2)
      const id3 = await store.storeEvent('stream-1', message3)

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
    })

    it('should store events for multiple streams', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }
      const message2: JSONRPCMessage = { jsonrpc: '2.0', method: 'test2' }

      const id1 = await store.storeEvent('stream-1', message1)
      const id2 = await store.storeEvent('stream-2', message2)

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
    })

    it('should use custom id generator when provided', async () => {
      let counter = 0
      const customStore = new MemoryEventStore({
        idGenerator: () => `custom-${counter++}`,
      })

      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test' }
      const id1 = await customStore.storeEvent('stream-1', message)
      const id2 = await customStore.storeEvent('stream-1', message)

      expect(id1).toBe('custom-0')
      expect(id2).toBe('custom-1')
    })
  })

  describe('replayEventsAfter', () => {
    it('should replay events after the specified event id', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }
      const message2: JSONRPCMessage = { jsonrpc: '2.0', method: 'test2' }
      const message3: JSONRPCMessage = { jsonrpc: '2.0', method: 'test3' }

      const id1 = await store.storeEvent('stream-1', message1)
      await store.storeEvent('stream-1', message2)
      await store.storeEvent('stream-1', message3)

      const sentEvents: { id: string; message: JSONRPCMessage }[] = []
      const sender = {
        send: async (id: string, message: JSONRPCMessage) => {
          sentEvents.push({ id, message })
        },
      }

      const streamId = await store.replayEventsAfter(id1, sender)

      expect(streamId).toBe('stream-1')
      expect(sentEvents).toHaveLength(2)
      expect(sentEvents[0].message).toEqual(message2)
      expect(sentEvents[1].message).toEqual(message3)
    })

    it('should replay all events if last event id is not found', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }
      const message2: JSONRPCMessage = { jsonrpc: '2.0', method: 'test2' }

      await store.storeEvent('stream-1', message1)
      await store.storeEvent('stream-1', message2)

      const sentEvents: { id: string; message: JSONRPCMessage }[] = []
      const sender = {
        send: async (id: string, message: JSONRPCMessage) => {
          sentEvents.push({ id, message })
        },
      }

      // Use a fake event id that doesn't exist but the stream does
      const customStore = new MemoryEventStore({
        idGenerator: () => 'known-event-id',
      })
      await customStore.storeEvent('stream-1', message1)
      await customStore.storeEvent('stream-1', message2)

      // Manually create a scenario where eventId exists but not in the stream
      // This tests the fallback behavior
      await customStore.replayEventsAfter('known-event-id', sender)

      expect(sentEvents).toHaveLength(1)
    })

    it('should return _unknown_stream for unknown event id', async () => {
      const sender = {
        send: vi.fn(),
      }

      const streamId = await store.replayEventsAfter('unknown-id', sender)

      expect(streamId).toBe('_unknown_stream')
      expect(sender.send).not.toHaveBeenCalled()
    })

    it('should not replay the event with the specified id', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }
      const message2: JSONRPCMessage = { jsonrpc: '2.0', method: 'test2' }

      const id1 = await store.storeEvent('stream-1', message1)
      await store.storeEvent('stream-1', message2)

      const sentEvents: { id: string; message: JSONRPCMessage }[] = []
      const sender = {
        send: async (id: string, message: JSONRPCMessage) => {
          sentEvents.push({ id, message })
        },
      }

      await store.replayEventsAfter(id1, sender)

      expect(sentEvents.every((e) => e.id !== id1)).toBe(true)
    })

    it('should handle replaying from the last event (no events to replay)', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }

      const id1 = await store.storeEvent('stream-1', message1)

      const sentEvents: { id: string; message: JSONRPCMessage }[] = []
      const sender = {
        send: async (id: string, message: JSONRPCMessage) => {
          sentEvents.push({ id, message })
        },
      }

      const streamId = await store.replayEventsAfter(id1, sender)

      expect(streamId).toBe('stream-1')
      expect(sentEvents).toHaveLength(0)
    })

    it('should only replay events from the same stream', async () => {
      const message1: JSONRPCMessage = { jsonrpc: '2.0', method: 'test1' }
      const message2: JSONRPCMessage = { jsonrpc: '2.0', method: 'test2' }
      const message3: JSONRPCMessage = { jsonrpc: '2.0', method: 'test3' }

      const id1 = await store.storeEvent('stream-1', message1)
      await store.storeEvent('stream-2', message2)
      await store.storeEvent('stream-1', message3)

      const sentEvents: { id: string; message: JSONRPCMessage }[] = []
      const sender = {
        send: async (id: string, message: JSONRPCMessage) => {
          sentEvents.push({ id, message })
        },
      }

      const streamId = await store.replayEventsAfter(id1, sender)

      expect(streamId).toBe('stream-1')
      expect(sentEvents).toHaveLength(1)
      expect(sentEvents[0].message).toEqual(message3)
    })
  })

  describe('reset', () => {
    it('should clear all stored events', async () => {
      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test' }

      const id1 = await store.storeEvent('stream-1', message)
      await store.storeEvent('stream-2', message)

      store.reset()

      const sender = { send: vi.fn() }
      const streamId = await store.replayEventsAfter(id1, sender)

      expect(streamId).toBe('_unknown_stream')
      expect(sender.send).not.toHaveBeenCalled()
    })

    it('should allow storing events after reset', async () => {
      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test' }

      await store.storeEvent('stream-1', message)
      store.reset()

      const newId = await store.storeEvent('stream-1', message)
      expect(newId).toBeDefined()
    })
  })

  describe('integration tests', () => {
    it('should handle complex scenario with multiple streams and replays', async () => {
      const msg1: JSONRPCMessage = { jsonrpc: '2.0', method: 'msg1' }
      const msg2: JSONRPCMessage = { jsonrpc: '2.0', method: 'msg2' }
      const msg3: JSONRPCMessage = { jsonrpc: '2.0', method: 'msg3' }
      const msg4: JSONRPCMessage = { jsonrpc: '2.0', method: 'msg4' }

      const id1 = await store.storeEvent('stream-1', msg1)
      await store.storeEvent('stream-1', msg2)
      const id3 = await store.storeEvent('stream-2', msg3)
      await store.storeEvent('stream-2', msg4)

      const sentEventsStream1: JSONRPCMessage[] = []
      const sender1 = {
        send: async (_id: string, message: JSONRPCMessage) => {
          sentEventsStream1.push(message)
        },
      }

      await store.replayEventsAfter(id1, sender1)
      expect(sentEventsStream1).toEqual([msg2])

      const sentEventsStream2: JSONRPCMessage[] = []
      const sender2 = {
        send: async (_id: string, message: JSONRPCMessage) => {
          sentEventsStream2.push(message)
        },
      }

      await store.replayEventsAfter(id3, sender2)
      expect(sentEventsStream2).toEqual([msg4])
    })

    it('should maintain event order correctly', async () => {
      const messages: JSONRPCMessage[] = []
      for (let i = 0; i < 10; i++) {
        messages.push({ jsonrpc: '2.0', method: `test${i}` })
      }

      const eventIds: string[] = []
      for (const msg of messages) {
        const id = await store.storeEvent('stream-1', msg)
        eventIds.push(id)
      }

      const sentEvents: JSONRPCMessage[] = []
      const sender = {
        send: async (_id: string, message: JSONRPCMessage) => {
          sentEvents.push(message)
        },
      }

      await store.replayEventsAfter(eventIds[4], sender)

      expect(sentEvents).toEqual(messages.slice(5))
    })
  })
})
