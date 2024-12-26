# GitHub Webhooks middleware for Hono

Middleware that allows you to receive and process GitHub Webhooks events in your Hono application.
It conveniently validates the incoming requests and provides you with a simple API to handle the
events.

## Installation

```bash
npm i @hono/github-webhooks
```

## Usage

> [!IMPORTANT]
> This middleware requires you to set the `GITHUB_WEBHOOK_SECRET` environment variable. This is the
> secret that GitHub uses to sign the payloads.

```ts
import { Hono } from 'hono'
import { gitHubWebhooksMiddleware } from './dist'

type Env = {
  GITHUB_WEBHOOK_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('/webhook', gitHubWebhooksMiddleware())

app.post('/webhook', async (c) => {
  const webhooks = c.get('webhooks')

  webhooks.on('star.created', async ({ id, name, payload }) => {
    console.log(`Received ${name} event with id ${id} and payload: ${payload}`)
  })
})
```

> [!TIP]
> This middleware builds upon the [GitHub Octokit Webhooks](https://github.com/octokit/webhooks.js)
> library. You can find the list of events and their payloads in the library's documentation.
