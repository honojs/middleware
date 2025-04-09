# Conform validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=conform-validator)](https://codecov.io/github/honojs/middleware)

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
    const data = submission.value

    return c.json({ success: true, message: `${data.name} is ${data.age}` })
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
    const data = submission.value
    return c.json({ success: true, message: `${data.name} is ${data.age}` })
  }
)
```

Valibot:

```ts
import { object, string } from 'valibot'
import { parseWithValibot } from '@conform-to/valibot'
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
    const data = submission.value
    return c.json({ success: true, message: `${data.name} is ${data.age}` })
  }
)
```

## Custom Hook Option

By default, `conformValidator()` returns a [`SubmissionResult`](https://github.com/edmundhung/conform/blob/6b98c077d757edd4846321678dfb6de283c177b1/packages/conform-dom/submission.ts#L40-L47) when a validation error occurs. If you wish to change this behavior, or if you wish to perform common processing, you can modify the response by passing a function as the second argument.

```ts
app.post(
  '/author',
  conformValidator(
    (formData) => parseWithYup(formData, { schema })
    (submission, c) => {
      if(submission.status !== 'success') {
        return c.json({ success: false, message: 'Bad Request' }, 400)
      }
    }
  ),
  (c) => {
    const submission = c.req.valid('form')
    const data = submission.value
    return c.json({ success: true, message: `${data.name} is ${data.age}` })
  }
)
```

> [!NOTE]
> if a response is returned by the Hook function, subsequent middleware or handler functions will not be executed. [see more](https://hono.dev/docs/concepts/middleware).

## Author

uttk <https://github.com/uttk>

## License

MIT
