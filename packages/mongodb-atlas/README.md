# MongoDB Atlas middleware for Hono

A MongoDB Atlas middleware for Hono

## Usage

```ts
// index.ts
import {Hono} from "hono";
import {mongoDBAtlas, getCollection, IMongoDBAtlasOptions} from '@hono/packages/mongodb-atlas/src/index'

const options: IMongoDBAtlasOptions = {
   realmAppId: "mongodb-real-app-id",
   realmApiKey: "mongodb-real-api-key"
}

const app = new Hono()
app.use('/', mongoDBAtlas(options))
app.get('/', async (c) => {
   const rs = await getCollection(c, 'test', 'users').find()
   return c.json(rs)
})

export default app;
```

## Author

Thinh Vu <https://github.com/ThinhVu>

## License

MIT
