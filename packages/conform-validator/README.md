# Conform validator middleware for Hono

The validator middleware using [conform](https://conform.guide) for [Hono](https://honojs.dev) applications. This middleware allows you to validate submitted FormValue and making better use of [Hono RPC](https://hono.dev/docs/guides/rpc).

## Usage

Zod:

```ts
import { z } from 'zod'
import { parseWithZod } from '@conform-to/zod'
import { conformValidator } from '@hono/conform-validator'
import { HTTPException } from 'hono/http-exception'

const schema = z.object({
  name: z.string(),
  age: z.string(),
})

app.post(
  '/author',
  conformValidator((formData) => parseWithZod(formData, { schema })),
  (c) => {
    const submission = c.req.valid('form')

    if (submission.status === 'success') {
      const data = submission.value

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}`,
      })
    }

    const res = c.json({ success: false, message: `Bad Request` }, 400)
    throw HTTPException(400, { res })
  }
)
```

Yup:

```ts
import { object, string } from 'yup'
import { parseWithYup } from '@conform-to/yup'
import { conformValidator } from '@hono/conform-validator'
import { HTTPException } from 'hono/http-exception'

const schema = object({
  name: string(),
  age: string(),
})

app.post(
  '/author',
  conformValidator((formData) => parseWithYup(formData, { schema })),
  (c) => {
    const submission = c.req.valid('form')

    if (submission.status === 'success') {
      const data = submission.value

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}`,
      })
    }

    const res = c.json({ success: false, message: `Bad Request` }, 400)
    throw HTTPException(400, { res })
  }
)
```

Valibot:

```ts
import { object, string } from 'valibot'
import { parseWithValibot } from 'conform-to-valibot'
import { conformValidator } from '@hono/conform-validator'
import { HTTPException } from 'hono/http-exception'

const schema = object({
  name: string(),
  age: string(),
})

app.post(
  '/author',
  conformValidator((formData) => parseWithYup(formData, { schema })),
  (c) => {
    const submission = c.req.valid('form')

    if (submission.status === 'success') {
      const data = submission.value

      return c.json({
        success: true,
        message: `${data.name} is ${data.age}`,
      })
    }

    const res = c.json({ success: false, message: `Bad Request` }, 400)
    throw HTTPException(400, { res })
  }
)
```

## Author

uttk <https://github.com/uttk>

## License

MIT
