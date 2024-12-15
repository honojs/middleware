---
'@hono/typia-validator': minor
---

Enables handling of `number`, `boolean`, and `bigint` types in query parameters and headers.

```diff
- import { typiaValidator } from '@hono/typia-validator';
+ import { typiaValidator } from '@hono/typia-validator/http';
  import { Hono } from 'hono';
  import typia, { type tags } from 'typia';

  interface Schema {
-   pages: `${number}`[];
+   pages: (number & tags.Type<'uint32'>)[];
  }
  
  const app = new Hono()
    .get(
      '/books',
      typiaValidator(
-       typia.createValidate<Schema>(),
+       typia.http.createValidateQuery<Schema>(),
        async (result, c) => {
          if (!result.success)
            return c.text('Invalid query parameters', 400);
-         return { pages: result.data.pages.map(Number) };
        }
      ),
      async c => {
        const { pages } = c.req.valid('query'); // { pages: number[] }
        //...
      }
    )
```