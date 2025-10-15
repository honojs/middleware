import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config'
import type { Plugin } from 'vitest/config'

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

export default defineWorkersProject({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2025-03-10',
          compatibilityFlags: ['nodejs_compat'],
          kvNamespaces: ['PUBLIC_JWK_CACHE_KV'],
        },
      },
    },
  },

  plugins: [firebasePlugin],
})
