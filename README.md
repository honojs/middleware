# monorepo for Hono third-party middleware

This repository is monorepo for third-party middleware of Hono.
We develop middleware in this repository and manage the issues and pull requests.

## What is third-party middleware?

Hono has three types of middleware.

1. Custom middleware - Created by users themselves.
2. Built-in middleware - Included in the Hono core package. It does not depend on any other external libraries.
3. Third-party middleware - Created outside of the core package. It can depend on the external libraries.

Third-party middleware is maintained in this `github.com/honojs/middleware` repository and published to npm in the `@hono` namespace. For example, a third-party middleware called hello is hosted at `github.com/honojs/middleware/packages/hello` and distributed under the name `@hono/hello`.
You can install it with the following command.

```
npm install @hono/hello
```

For Deno, we do not publish them on `deno.land/x`, but distribute them via CDNs such as Skypack and esm.sh. We will also use the `npm:` that will be introduced in the Deno itself in the future.

```ts
import { hello } from 'npm:@hono/hello'
```

## How to contribute

Anyone can propose third-party Middleware.
The Hono maintainers and other contributors will discuss whether we accept the middleware or not.
If it's OK, it will be maintained in this repository.
The proposer maintains it.

The specific flow is as follows

1. Clone this repository
2. Write your middleware. Refer to [hello Middleware](https://github.com/honojs/middleware/tree/main/packages/hello).
3. Create the pull request.

We use [changesets](https://github.com/changesets/changesets) to manage releases and CHANGELOG.
Run the following command at the top level to describe any changes.

```
bun changeset
```

When merged into the main, a pull request for release is created.
The Hono maintainers will merge it to release the package at the appropriate time.

## Author & License

The Author of this repository is Yusuke Wada <<https://github.com/yusukebe>>. However, the code under the `packages/*` is in each Middleware author.
Basically, distributed under the MIT license.
