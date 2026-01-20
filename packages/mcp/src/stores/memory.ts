import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

export type MemoryEventStoreOptions = {
  /**
   * The number of streams to store in the memory
   * @default 100
   */
  streamBufferSize?: number
  /**
   * The number of events to store per stream in the memory
   * @default 100
   */
  eventsPerStreamBufferSize?: number
  /**
   * The function to generate a unique id for the event
   * @default () => crypto.randomUUID()
   */
  idGenerator?: () => string
}

/**
 * Simple in-memory implementation of EventStore for resumability
 */
export class MemoryEventStore implements EventStore {
  #eventsPerStreamBufferSize: number
  #items: RingBuffer<{
    streamId: string
    events: RingBuffer<{ id: string; message: JSONRPCMessage }>
  }>
  #idToIndexMap: Map<string, number>
  #eventIdToStreamIdMap: Map<string, string>
  #idGenerator: () => string

  constructor(options: MemoryEventStoreOptions = {}) {
    const {
      streamBufferSize = 100,
      eventsPerStreamBufferSize = 100,
      idGenerator = () => crypto.randomUUID(),
    } = options

    this.#idToIndexMap = new Map()
    this.#eventIdToStreamIdMap = new Map()

    this.#eventsPerStreamBufferSize = eventsPerStreamBufferSize
    this.#idGenerator = idGenerator

    this.#items = new RingBuffer(streamBufferSize, ({ streamId, events }) => {
      this.#idToIndexMap.delete(streamId)
      events.reset()
    })
  }

  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = this.#idGenerator()
    this.#eventIdToStreamIdMap.set(eventId, streamId)

    if (
      !this.#idToIndexMap.has(streamId) ||
      this.#items.get(this.#idToIndexMap.get(streamId)!) == null
    ) {
      this.#idToIndexMap.set(streamId, this.#items.head)
      this.#items.push({
        streamId,
        events: new RingBuffer(this.#eventsPerStreamBufferSize, ({ id }) => {
          this.#eventIdToStreamIdMap.delete(id)
        }),
      })
    }

    // Adding the message in the stream
    this.#items.get(this.#idToIndexMap.get(streamId)!)!.events.push({ id: eventId, message })

    return eventId
  }

  async replayEventsAfter(
    lastEventId: string,
    sender: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> }
  ): Promise<string> {
    const streamId = this.#eventIdToStreamIdMap.get(lastEventId)
    if (!streamId) {
      return '_unknown_stream'
    }

    const streamEvents = this.#items.get(this.#idToIndexMap.get(streamId)!)!.events.read()
    const lastEventIndex = streamEvents.findIndex((event) => event.id === lastEventId)

    // If the last event is found, replay events after it, otherwise replay all events
    const filteredStreamEvents =
      lastEventIndex > -1 ? streamEvents.slice(lastEventIndex + 1) : streamEvents

    for (const event of filteredStreamEvents) {
      await sender.send(event.id, event.message)
    }

    return streamId
  }

  reset(): void {
    this.#items.reset()
    this.#idToIndexMap.clear()
    this.#eventIdToStreamIdMap.clear()
  }
}

/**
 * Simple ring buffer implementation
 * @internal
 */
export class RingBuffer<T> {
  #items: T[]
  #head: number
  #tail: number
  #size: number
  #cleanupCallback?: (item: T) => void

  constructor(size: number, cleanupCallback?: (item: T) => void) {
    this.#items = new Array(size)
    this.#head = 0
    this.#tail = 0
    this.#size = size
    this.#cleanupCallback = cleanupCallback
  }

  get head(): number {
    return this.#head
  }

  push(item: T): void {
    const index = this.#head % this.#size

    const oldValue = this.#items[index]
    if (oldValue != null && this.#cleanupCallback != null) {
      this.#cleanupCallback(oldValue)
    }

    this.#items[index] = item
    this.#head++
    this.#tail = Math.max(this.#tail, this.#head - this.#size)
  }

  get(index: number): T | undefined {
    if (index < this.#tail || index >= this.#head) {
      return undefined
    }

    return this.#items[index % this.#size]
  }

  read(): T[] {
    const itemsInOrder: T[] = []
    for (let i = this.#tail; i < this.#head; i++) {
      const item = this.get(i)

      if (item == null) {
        break
      }

      itemsInOrder.push(item)
    }

    return itemsInOrder
  }

  reset(): void {
    if (this.#cleanupCallback != null) {
      for (const item of this.read()) {
        this.#cleanupCallback(item)
      }
    }

    this.#items = new Array(this.#size)
    this.#head = 0
    this.#tail = 0
  }
}
