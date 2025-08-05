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
      // The base URL of the site, used to generate full URLs in the sitemap.
      baseUrl: 'https://example.com',
      // Whether to canonicalize URLs in the sitemap. If true, URLs ending with `.html` are canonicalized to remove the extension (e.g., `/foo.html` -> `/foo`). URLs ending with `index.html` are always canonicalized. Default is true.
      canonicalize: true,
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
      // An array of rules for user agents.
      rules: [
        { userAgent: '*', allow: ['/'], disallow: ['/private'] },
        { userAgent: 'Googlebot', allow: ['/'] },
      ],
      // The URL of the sitemap to include in the `robots.txt` file.
      sitemapUrl: 'https://example.com/sitemap.xml',
      // An array of extra lines to include in the robots.txt file.
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
      // The base URL of the site, used to generate full URLs in the RSS feed.
      baseUrl: 'https://example.com',
      // The title of the RSS feed.
      feedTitle: 'My Blog',
      // The description of the RSS feed.
      feedDescription: 'Latest updates from my blog.',
      // The type of RSS feed to generate. Default is RSS 2.0.
      feedType: 'rss2',
      // Whether to canonicalize URLs in the RSS feed. If true, URLs ending with `.html` are canonicalized to remove the extension (e.g., `/foo.html` -> `/foo`). URLs ending with `index.html` are always canonicalized. Default is true.
      canonicalize: true,
    }),
  ],
})
```

## Author

3w36zj6 <https://github.com/3w36zj6>

## License

MIT
