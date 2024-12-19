# Supabase middleware for Hono

This is a [Supabase](https://supabase.com) third-party middleware for [Hono](https://github.com/honojs/hono).

This middleware can be used to inject the active Supabase session into the request context.

## Installation

```plain
npm i hono @hono/supabase-auth
pnpm add hono @hono/supabase-auth
```

## Configuration

Before starting using the middleware you must set the following environment variables or set in custom config:

```plain
SUPABASE_JWT_SECRET=<Your-jwt-secret>
```

## How to Use Server(Next.js)

```ts
import { createClient } from '@supabase/supabase-js'
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { checkToken, getSupabaseAuth } from '@hono/supabash-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
// server: user in api route
export const supabaseWithAuth = (token: string) =>
  createClient(supabaseUrl!, supabaseKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

const hono = new Hono()
  .basePath('/api')
  .use(checkToken(process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET))
  .get('/', async (c) => {
    const { token } = getSupabaseAuth(c)

    // send token to supabase
    const { data, error } = await supabaseWithAuth(token)
      // you supabase from name
      .from('MapList')
      .select('*')
    if (error) {
      return c.json({ message: error.message }, 500)
    }
    return c.json(data)
  })

export const GET = handle(hono)
export type App = typeof hono
```

## How to Use Client(Next.js)

```tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { hc } from 'hono/client'
import type { App } from '@/app/api/route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
export const supabase = createClient(supabaseUrl!, supabaseKey!)

// client: get user login session
export const getUserSession = () => {
  return supabase.auth.getSession()
}
// client: use client send request
export const client = hc<App>(process.env.NEXT_PUBLIC_URL!).api

export default function Home() {
  const [data, setData] = useState<object[]>([])
  useEffect(() => {
    ;(async () => {
      const data = await client.$get(undefined, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      })
      if (data.ok) {
        const dataed = await data.json()
        console.log(dataed)
        setData(dataed)
      }
    })()
  }, [])
  return <div>{JSON.stringify(data)}</div>
}
```

# Next.js example

[hono-supabase-auth-example](https://github.com/ljh12138164/hono-supabash-auth-example)

## Author

ljh12138164 <https://github.com/ljh12138164>
