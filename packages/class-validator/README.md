# Class-validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=class-validator)](https://codecov.io/github/honojs/middleware)

The validator middleware using [class-validator](https://github.com/typestack/class-validator) for [Hono](https://github.com/honojs/hono) applications.

## Usage

```ts
import { classValidator } from '@hono/class-validator'
import { IsInt, IsString } from 'class-validator'

class CreateUserDto {
  @IsString()
  name!: string

  @IsInt()
  age!: number
}

const route = app.post('/user', classValidator('json', CreateUserDto), (c) => {
  const user = c.req.valid('json')
  return c.json({ success: true, message: `${user.name} is ${user.age}` })
})
```

With hook:

```ts
import { classValidator } from '@hono/class-validator'
import { IsInt, IsString } from 'class-validator'

class CreateUserDto {
  @IsString()
  name!: string

  @IsInt()
  age!: number
}

app.post(
  '/user',
  classValidator('json', CreateUserDto, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

## Author

**Pr0m3ht3us** - https://github.com/pr0m3th3usex

## License

MIT
