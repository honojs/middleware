import type { Plugin } from 'vitest/config'
import { defineProject } from 'vitest/config'

const firebasePlugin = {
  name: 'firebase',
  async configureServer(server) {
    const { default: client } = await import('firebase-tools')

    void client.emulators.start({
      cwd: server.config.root,
      nonInteractive: true,
      project: 'example-project12345',
      projectDir: server.config.root,
    })
  },
  async buildEnd() {
    const { default: controller } = await import('firebase-tools/lib/emulator/controller')

    await controller.cleanShutdown()
  },
} satisfies Plugin

export default defineProject({
  test: {
    globals: true,
  },

  plugins: [firebasePlugin],
})
