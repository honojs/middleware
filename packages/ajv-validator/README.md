# Ajv validator middleware for Hono

Validator middleware using [Ajv](https://github.com/ajv-validator/ajv) for [Hono](https://honojs.dev) applications.
Define your schema with Ajv and validate incoming requests.

## Usage

No Hook:

```ts
import { type JSONSchemaType } from 'ajv';
import { ajvValidator } from '@hono/ajv-validator';
 
const schema: JSONSchemaType<{ name: string; age: number }> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
  additionalProperties: false,
} as const;

const route = app.post('/user', ajvValidator('json', schema), (c) => {
  const user = c.req.valid('json');
  return c.json({ success: true, message: `${user.name} is ${user.age}` });
});
```

Hook:

```ts
import { type JSONSchemaType } from 'ajv';
import { ajvValidator } from '@hono/ajv-validator';

const schema: JSONSchemaType<{ name: string; age: number }> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
  additionalProperties: false,
};

app.post(
  '/user',
  ajvValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400);
    }
  })
  //...
);
```

## Author

Illia Khvost <https://github.com/ikhvost>

## License

MIT
