import { Hono } from 'hono';
import type { Equal, Expect } from 'hono/utils/types';
import { ajvValidator } from '../src';
import { JSONSchemaType, type ErrorObject } from 'ajv';

type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never;

describe('Basic', () => {
  const app = new Hono();

  const schema: JSONSchemaType<{ name: string; age: number }> = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
    additionalProperties: false,
  };

  const route = app.post('/author', ajvValidator('json', schema), (c) => {
    const data = c.req.valid('json');
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    });
  });

  type Actual = ExtractSchema<typeof route>;
  type Expected = {
    '/author': {
      $post: {
        input: {
          json: {
            name: string;
            age: number;
          };
        };
        output: {
          success: boolean;
          message: string;
        };
      };
    };
  };

  type verify = Expect<Equal<Expected, Actual>>;

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        age: 20,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await app.request(req);
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: 'Superman is 20',
    });
  });

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/author', {
      body: JSON.stringify({
        name: 'Superman',
        age: '20',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await app.request(req);
    expect(res).not.toBeNull();
    expect(res.status).toBe(400);
    const data = (await res.json()) as { success: boolean };
    expect(data.success).toBe(false);
  });
});

describe('With Hook', () => {
  const app = new Hono();

  const schema: JSONSchemaType<{ id: number; title: string }> = {
    type: 'object',
    properties: {
      id: { type: 'number' },
      title: { type: 'string' },
    },
    required: ['id', 'title'],
    additionalProperties: false,
  };

  app
    .post(
      '/post',
      ajvValidator('json', schema, (result, c) => {
        if (!result.success) {
          return c.text('Invalid!', 400);
        }
        const data = result.data;
        return c.text(`${data.id} is valid!`);
      }),
      (c) => {
        const data = c.req.valid('json');
        return c.json({
          success: true,
          message: `${data.id} is ${data.title}`,
        });
      }
    )
    .post(
      '/errorTest',
      ajvValidator('json', schema, (result, c) => {
        return c.json(result, 400);
      }),
      (c) => {
        const data = c.req.valid('json');
        return c.json({
          success: true,
          message: `${data.id} is ${data.title}`,
        });
      }
    );

  it('Should return 200 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: 123,
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await app.request(req);
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('123 is valid!');
  });

  it('Should return 400 response', async () => {
    const req = new Request('http://localhost/post', {
      body: JSON.stringify({
        id: '123',
        title: 'Hello',
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await app.request(req);
    expect(res).not.toBeNull();
    expect(res.status).toBe(400);
  });

  it('Should return 400 response and error array', async () => {
    const req = new Request('http://localhost/errorTest', {
      body: JSON.stringify({
        id: 123,
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const res = await app.request(req);
    expect(res).not.toBeNull();
    expect(res.status).toBe(400);

    const { errors, success } = (await res.json()) as {
      success: boolean;
      errors: ErrorObject[];
    };
    expect(success).toBe(false);
    expect(Array.isArray(errors)).toBe(true);
    expect(
      errors.map((e: ErrorObject) => ({
        keyword: e.keyword,
        instancePath: e.instancePath,
        message: e.message,
      }))
    ).toEqual([
      {
        keyword: 'required',
        instancePath: '',
        message: "must have required property 'title'",
      },
    ]);
  });
});
