import { defineConfig } from 'tsdown'

export default defineConfig({
  attw: {
    profile: 'node16',
  },
  clean: true,
  dts: true,
  entry: {
    sitemap: 'src/plugins/sitemap.ts',
    'robots-txt': 'src/plugins/robots-txt.ts',
    rss: 'src/plugins/rss.ts',
  },
  format: ['cjs', 'esm'],
  publint: true,
  tsconfig: 'tsconfig.build.json',
})
