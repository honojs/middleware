import { defineConfig } from 'vite-plus'
import { pack } from '../../vite.shared.ts'

export default defineConfig({
  pack: {
    ...pack,
    attw: {
      profile: 'node16',
    },
    entry: {
      sitemap: 'src/plugins/sitemap.ts',
      'robots-txt': 'src/plugins/robots-txt.ts',
      rss: 'src/plugins/rss.ts',
    },
  },
  test: {
    globals: true,
  },
})
