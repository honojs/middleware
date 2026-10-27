import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

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

export default defineConfig({
  pack: {
    ...pack,
    entry: 'src/index.ts',
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2025-03-10',
        compatibilityFlags: ['nodejs_compat'],
        kvNamespaces: ['PUBLIC_JWK_CACHE_KV'],
      },
    }),
    firebasePlugin,
  ],
})
