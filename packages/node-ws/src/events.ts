interface CloseEventInit extends EventInit {
  code?: number
  reason?: string
  wasClean?: boolean
}

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
 */
export const CloseEvent: typeof globalThis.CloseEvent =
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

interface ErrorEventInit extends EventInit {
  message?: string
  filename?: string
  lineno?: number
  colno?: number
  error?: unknown
}

/**
 * `ErrorEvent` is not a global in every supported Node.js version
 * (it is missing on Node.js 18, 20, and 22).
 * @link https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent
 */
export const ErrorEvent: typeof globalThis.ErrorEvent =
  globalThis.ErrorEvent ??
  class extends Event {
    #eventInitDict

    constructor(type: string, eventInitDict: ErrorEventInit = {}) {
      super(type, eventInitDict)
      this.#eventInitDict = eventInitDict
    }

    get message(): string {
      return this.#eventInitDict.message ?? ''
    }

    get filename(): string {
      return this.#eventInitDict.filename ?? ''
    }

    get lineno(): number {
      return this.#eventInitDict.lineno ?? 0
    }

    get colno(): number {
      return this.#eventInitDict.colno ?? 0
    }

    get error(): unknown {
      return this.#eventInitDict.error
    }
  }
