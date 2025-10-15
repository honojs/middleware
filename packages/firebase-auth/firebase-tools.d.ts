declare module 'cloudflare:test' {
  interface ProvidedEnv {
    PUBLIC_JWK_CACHE_KV: KVNamespace
  }
}

declare module 'firebase-tools' {
  const client: {
    emulators: {
      start(options: {
        cwd: string
        nonInteractive: boolean
        project: string
        projectDir: string
      }): Promise<void>
    }
  }

  export = client
}

declare module 'firebase-tools/lib/emulator/controller' {
  const controller: {
    cleanShutdown(): Promise<void>
  }

  export = controller
}
