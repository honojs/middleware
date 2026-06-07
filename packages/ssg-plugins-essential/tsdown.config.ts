import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  entry: {
    sitemap: 'src/plugins/sitemap.ts',
    'robots-txt': 'src/plugins/robots-txt.ts',
    rss: 'src/plugins/rss.ts',
  },
})
