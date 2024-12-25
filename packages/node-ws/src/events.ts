interface CloseEventInit extends EventInit {
  code?: number
  reason?: string
  wasClean?: boolean
}

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
 */
export const CloseEvent =
  globalThis.CloseEvent ??
  class extends Event {
    #eventInitDict

    constructor(type: string, eventInitDict: CloseEventInit = {}) {
      super(type, eventInitDict)
      this.#eventInitDict = eventInitDict
    }

    get wasClean(): boolean {
      return this.#eventInitDict.wasClean ?? false
    }

    get code(): number {
      return this.#eventInitDict.code ?? 0
    }

    get reason(): string {
      return this.#eventInitDict.reason ?? ''
    }
  }
