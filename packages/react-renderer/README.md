# React Renderer Middleware

React Renderer Middleware allows for the easy creation of a renderer based on React for Hono.

## Installation

```txt
npm i @hono/react-renderer react react-dom hono
npm i -D @types/react @types/react-dom
```

## Settings

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

If you are using Vite, add `ssr external` config to `vite.config.ts`:

```typescript
import build from '@hono/vite-cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  ssr: {
    external: ['react', 'react-dom'], // <== add
  },
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx',
    }),
  ],
})
```

## Usage

### Basic

```tsx
import { Hono } from 'hono'
import { reactRenderer } from '@hono/react-renderer'

const app = new Hono()

app.get(
  '*',
  reactRenderer(({ children }) => {
    return (
      <html>
        <body>
          <h1>React + Hono</h1>
          <div>{children}</div>
        </body>
      </html>
    )
  })
)

app.get('/', (c) => {
  return c.render(<p>Welcome!</p>)
})
```

### Extending `Props`

You can define types of `Props`:

```tsx
declare module '@hono/react-renderer' {
  interface Props {
    title: string
  }
}
```

Then, you can use it in the `reactRenderer()` function and pass values as a second argument to `c.render()`:

```tsx
app.get(
  '*',
  reactRenderer(({ children, title }) => {
    return (
      <html>
        <head>
          <title>{title}</title>
        </head>
        <body>
          <div>{children}</div>
        </body>
      </html>
    )
  })
)

app.get('/', (c) => {
  return c.render(<p>Welcome!</p>, {
    title: 'Top Page',
  })
})
```

### `useRequestContext()`

You can get an instance of `Context` in a function component:

```tsx
const Component = () => {
  const c = useRequestContext()
  return <p>You access {c.req.url}</p>
}

app.get('/', (c) => {
  return c.render(<Component />)
})
```

## Options

### `docType`

If you set it `true`, `DOCTYPE` will be added:

```tsx
app.get(
  '*',
  reactRenderer(
    ({ children }) => {
      return (
        <html>
          <body>
            <div>{children}</div>
          </body>
        </html>
      )
    },
    {
      docType: true,
    }
  )
)
```

The HTML is the following:

```html
<!DOCTYPE html>
<html>
  <body>
    <div><p>Welcome!</p></div>
  </body>
</html>
```

You can specify the `docType` as you like.

```tsx
app.get(
  '*',
  reactRenderer(
    ({ children }) => {
      return (
        <html>
          <body>
            <div>{children}</div>
          </body>
        </html>
      )
    },
    {
      docType:
        '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">',
    }
  )
)
```

### `stream`

It enables returning a streaming response. You can use a `Suspense` with it:

```tsx
import { reactRenderer } from '@hono/react-renderer'
import { Suspense } from 'react'

app.get(
  '*',
  reactRenderer(
    ({ children }) => {
      return (
        <html>
          <body>
            <div>{children}</div>
          </body>
        </html>
      )
    },
    {
      stream: true,
    }
  )
)

let done = false

const Component = () => {
  if (done) {
    return <p>Done!</p>
  }
  throw new Promise((resolve) => {
    done = true
    setTimeout(resolve, 1000)
  })
}

app.get('/', (c) => {
  return c.render(
    <Suspense fallback='loading...'>
      <Component />
    </Suspense>
  )
})
```

## Limitation

A streaming feature is not available on Vite or Vitest.

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
