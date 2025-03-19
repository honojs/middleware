# @hono/typia-validator

## 0.1.1

### Patch Changes

- [#1024](https://github.com/honojs/middleware/pull/1024) [`4f1782919154946a4105a113884f2ae929dc9317`](https://github.com/honojs/middleware/commit/4f1782919154946a4105a113884f2ae929dc9317) Thanks [@gronxb](https://github.com/gronxb)! - Include `typia@8` as a peer dependency

## 0.1.0

### Minor Changes

- [#888](https://github.com/honojs/middleware/pull/888) [`c63470e4915a0680c624bf97d52487572185a2d5`](https://github.com/honojs/middleware/commit/c63470e4915a0680c624bf97d52487572185a2d5) Thanks [@miyaji255](https://github.com/miyaji255)! - Enables handling of `number`, `boolean`, and `bigint` types in query parameters and headers.

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

## 0.0.5

### Patch Changes

- [#570](https://github.com/honojs/middleware/pull/570) [`66366075d4f268ad0190a30f1c77ca433cacf0b3`](https://github.com/honojs/middleware/commit/66366075d4f268ad0190a30f1c77ca433cacf0b3) Thanks [@ryoppippi](https://github.com/ryoppippi)! - PeerDependency of Typia is updated from v5 to v6

## 0.0.4

### Patch Changes

- [#488](https://github.com/honojs/middleware/pull/488) [`1cc5e0a5b07a14723c5d21ceea33ad9caef33025`](https://github.com/honojs/middleware/commit/1cc5e0a5b07a14723c5d21ceea33ad9caef33025) Thanks [@Frog-kt](https://github.com/Frog-kt)! - Fixed a part of deprecated response json method in hono since v4.

## 0.0.3

### Patch Changes

- [#219](https://github.com/honojs/middleware/pull/219) [`b3d80a0`](https://github.com/honojs/middleware/commit/b3d80a0cca92db6b243d3a6e9761c20d931136a2) Thanks [@yusukebe](https://github.com/yusukebe)! - bump hono version of `peerDependencies`

## 0.0.2

### Patch Changes

- [#158](https://github.com/honojs/middleware/pull/158) [`2e4eeb0`](https://github.com/honojs/middleware/commit/2e4eeb0b70ab8055739642e50b86351c80d48341) Thanks [@dworznik](https://github.com/dworznik)! - Add Typia validator
