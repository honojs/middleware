# Typia validator middleware for Hono

The validator middleware using [Typia](https://typia.io/docs/) for [Hono](https://honojs.dev) applications.

## Usage

You can use [Basic Validation](#basic-validation) and [HTTP Module Validation](#http-module-validation) with Typia Validator.

### Basic Validation

Use only the standard validator in typia.

```ts
import typia, { tags } from 'typia'
import { typiaValidator } from '@hono/typia-validator'

interface Author {
  name: string
  age: number & tags.Type<'uint32'> & tags.Minimum<20> & tags.ExclusiveMaximum<100>
}

const validate = typia.createValidate<Author>()

const route = app.post('/author', typiaValidator('json', validate), (c) => {
  const data = c.req.valid('json')
  return c.json({
    success: true,
    message: `${data.name} is ${data.age}`,
  })
})
```

Hook:

```ts
app.post(
  '/post',
  typiaValidator('json', validate, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

### HTTP Module Validation

[Typia's HTTP module](https://typia.io/docs/misc/#http-module) allows you to validate query and header parameters with automatic type parsing.

- **Supported Parsers:** The HTTP module currently supports "query" and "header" validations.
- **Parsing Differences:** The parsing mechanism differs slightly from Hono's native parsers. Ensure that your type definitions comply with Typia's HTTP module restrictions.

```typescript
import { Hono } from 'hono'
import typia from 'typia'
import { typiaValidator } from '@hono/typia-validator/http'

interface Author {
  name: string
  age: number & tags.Type<'uint32'> & tags.Minimum<20> & tags.ExclusiveMaximum<100>
}

interface IQuery {
  limit?: number
  enforce: boolean
  values?: string[]
  atomic: string | null
  indexes: number[]
}
interface IHeaders {
  'x-category': 'x' | 'y' | 'z'
  'x-memo'?: string
  'x-name'?: string
  'x-values': number[]
  'x-flags': boolean[]
  'x-descriptions': string[]
}

const app = new Hono()

const validate = typia.createValidate<Author>()
const validateQuery = typia.http.createValidateQuery<IQuery>()
const validateHeaders = typia.http.createValidateHeaders<IHeaders>()

app.get('/items',
  typiaValidator('json', validate),
  typiaValidator('query', validateQuery),
  typiaValidator('header', validateHeaders),
  (c) => {
    const query = c.req.valid('query')
    const headers = c.req.valid('header')
    return c.json({
      success: true,
      query,
      headers,
    })
  }
)
```
## Author

Patryk Dwórznik <https://github.com/dworznik>

## License

MIT
