import { Hono } from 'hono';
import type { Equal, Expect } from 'hono/utils/types';
import type { tags } from 'typia';
import typia from 'typia';
import { typiaValidator } from "../src";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ExtractSchema<T> = T extends Hono<infer _, infer S> ? S : never;
describe('Basic', () => {
    const app = new Hono();
    interface Author {
        name: string;
        age: number & tags.Type<'uint32'> & tags.Minimum<20> & tags.ExclusiveMaximum<100>;
    }
    const validate = (input: any): typia.IValidation<Author> => {
        const errors = [] as any[];
        const __is = (input: any): input is Author => {
            return "object" === typeof input && null !== input && ("string" === typeof (input as any).name && ("number" === typeof (input as any).age && (Math.floor((input as any).age) === (input as any).age && 0 <= (input as any).age && (input as any).age <= 4294967295 && 20 <= (input as any).age && (input as any).age < 100)));
        };
        if (false === __is(input)) {
            const $report = (typia.createValidate as any).report(errors);
            ((input: any, _path: string, _exceptionable: boolean = true): input is Author => {
                const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["string" === typeof input.name || $report(_exceptionable, {
                        path: _path + ".name",
                        expected: "string",
                        value: input.name
                    }), "number" === typeof input.age && (Math.floor(input.age) === input.age && 0 <= input.age && input.age <= 4294967295 || $report(_exceptionable, {
                        path: _path + ".age",
                        expected: "number & Type<\"uint32\">",
                        value: input.age
                    })) && (20 <= input.age || $report(_exceptionable, {
                        path: _path + ".age",
                        expected: "number & Minimum<20>",
                        value: input.age
                    })) && (input.age < 100 || $report(_exceptionable, {
                        path: _path + ".age",
                        expected: "number & ExclusiveMaximum<100>",
                        value: input.age
                    })) || $report(_exceptionable, {
                        path: _path + ".age",
                        expected: "(number & Type<\"uint32\"> & Minimum<20> & ExclusiveMaximum<100>)",
                        value: input.age
                    })].every((flag: boolean) => flag);
                return ("object" === typeof input && null !== input || $report(true, {
                    path: _path + "",
                    expected: "Author",
                    value: input
                })) && $vo0(input, _path + "", true) || $report(true, {
                    path: _path + "",
                    expected: "Author",
                    value: input
                });
            })(input, "$input", true);
        }
        const success = 0 === errors.length;
        return {
            success,
            errors,
            data: success ? input : undefined
        } as any;
    };
    const route = app.post('/author', typiaValidator('json', validate), (c) => {
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
                    json: Author;
                };
                output: {
                    success: boolean;
                    message: string;
                };
            };
        };
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type verify = Expect<Equal<Expected, Actual>>;
    it('Should return 200 response', async () => {
        const req = new Request('http://localhost/author', {
            body: JSON.stringify({
                name: 'Superman',
                age: 30,
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
            message: 'Superman is 30',
        });
    });
    it('Should return 400 response', async () => {
        const req = new Request('http://localhost/author', {
            body: JSON.stringify({
                name: 'Superman',
                age: 18,
            }),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const res = await app.request(req);
        expect(res).not.toBeNull();
        expect(res.status).toBe(400);
        const data = (await res.json()) as {
            success: boolean;
        };
        expect(data['success']).toBe(false);
    });
});
describe('With Hook', () => {
    const app = new Hono();
    interface Item {
        id: number & tags.ExclusiveMaximum<9999>;
        title: string;
    }
    const validate = (input: any): typia.IValidation<Item> => {
        const errors = [] as any[];
        const __is = (input: any): input is Item => {
            return "object" === typeof input && null !== input && ("number" === typeof (input as any).id && (input as any).id < 9999 && "string" === typeof (input as any).title);
        };
        if (false === __is(input)) {
            const $report = (typia.createValidate as any).report(errors);
            ((input: any, _path: string, _exceptionable: boolean = true): input is Item => {
                const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["number" === typeof input.id && (input.id < 9999 || $report(_exceptionable, {
                        path: _path + ".id",
                        expected: "number & ExclusiveMaximum<9999>",
                        value: input.id
                    })) || $report(_exceptionable, {
                        path: _path + ".id",
                        expected: "(number & ExclusiveMaximum<9999>)",
                        value: input.id
                    }), "string" === typeof input.title || $report(_exceptionable, {
                        path: _path + ".title",
                        expected: "string",
                        value: input.title
                    })].every((flag: boolean) => flag);
                return ("object" === typeof input && null !== input || $report(true, {
                    path: _path + "",
                    expected: "Item",
                    value: input
                })) && $vo0(input, _path + "", true) || $report(true, {
                    path: _path + "",
                    expected: "Item",
                    value: input
                });
            })(input, "$input", true);
        }
        const success = 0 === errors.length;
        return {
            success,
            errors,
            data: success ? input : undefined
        } as any;
    };
    app.post('/post', typiaValidator('json', validate, (result, c) => {
        if (!result.success) {
            return c.text(`${result.data.id} is invalid!`, 400);
        }
        const data = result.data;
        return Promise.resolve(c.text(`${data.id} is valid!`));
    }), (c) => {
        const data = c.req.valid('json');
        return c.json({
            success: true,
            message: `${data.id} is ${data.title}`,
        });
    });
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
        expect(await res.text()).toBe('123 is invalid!');
    });
});
