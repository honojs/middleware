import UnpluginTypia from '@typia/unplugin/vite'
import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: ['src/index.ts', 'src/http.ts'],
  },
  plugins: [
    UnpluginTypia({
      tsconfig: './tsconfig.build.json',
    }),
  ],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
