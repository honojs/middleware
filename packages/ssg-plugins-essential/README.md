# Essential plugins for Hono SSG

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=ssg-plugins-essential)](https://codecov.io/github/honojs/middleware)

Essential plugins for [Hono SSG](https://hono.dev/docs/helpers/ssg).
This plugin collection provides standard and lightweight plugins essential for static site generation.

- Sitemap plugin
- robots.txt plugin
- RSS/Atom plugin

## Installation

```sh
# npm
npm install @hono/ssg-plugins-essential

# Yarn
yarn add @hono/ssg-plugins-essential

# pnpm
pnpm add @hono/ssg-plugins-essential

# Bun
bun add @hono/ssg-plugins-essential
```

## Usage

These plugins can be easily integrated into your Hono SSG project.
Simply add them to the `plugins` array when calling `toSSG`.
Each plugin will automatically generate the corresponding file (e.g., `sitemap.xml`, `robots.txt`, or `rss.xml`) during the static site generation process.

```tsx
// index.tsx
import { Hono } from 'hono'
import { toSSG } from 'hono/ssg'
import fs from 'fs/promises'

declare module 'hono' {
  interface ContextRenderer {
    (
      content: string | Promise<string>,
      head: { title: string; description?: string }
    ): Response | Promise<Response>
  }
}

const app = new Hono()

app.use('/*', async (c, next) => {
  c.setRenderer((content, head) => {
    return c.html(
      <html>
        <head>
          <title>{head.title ?? ''}</title>
          {head.description && <meta name='description' content={head.description} />}
        </head>
        <body>
          <p>{content}</p>
        </body>
      </html>
    )
  })
  await next()
})

app.get('/', (c) => c.render('home page content', { title: 'Home Page' }))
app.get('/about', (c) => {
  return c.render('about page content', {
    title: 'About Page',
    description: 'This is the about page.',
  })
})

toSSG(app, fs, {
  plugins: [], // Add any required SSG plugins here.
})
```

### Sitemap plugin

```tsx
import { sitemapPlugin } from '@hono/ssg-plugins-essential/sitemap'

toSSG(app, fs, {
  plugins: [
    sitemapPlugin({
      baseUrl: 'https://example.com',
    }),
  ],
})
```

### robots.txt plugin

```tsx
import { robotsTxtPlugin } from '@hono/ssg-plugins-essential/robots-txt'

toSSG(app, fs, {
  plugins: [
    robotsTxtPlugin({
      rules: [
        { userAgent: '*', allow: ['/'], disallow: ['/private'] },
        { userAgent: 'Googlebot', allow: ['/'] },
      ],
      sitemapUrl: 'https://example.com/sitemap.xml',
      extraLines: ['# This is a comment.'],
    }),
  ],
})
```

### RSS/Atom plugin

```tsx
import { rssPlugin } from '@hono/ssg-plugins-essential/rss'

toSSG(app, fs, {
  plugins: [
    rssPlugin({
      baseUrl: 'https://example.com',
      feedTitle: 'My Blog',
      feedDescription: 'Latest updates from my blog.',
      feedType: 'rss2',
    }),
  ],
})
```

## Author

3w36zj6 <https://github.com/3w36zj6>

## License

MIT
