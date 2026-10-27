import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: {
      index: 'src/index.ts',
      client: 'src/client.ts',
      'jsx-dev-runtime': 'src/jsx-dev-runtime.ts',
      'jsx-runtime': 'src/jsx-runtime.ts',
      server: 'src/server.ts',
    },
  },
})
