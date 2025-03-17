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
