# MongoDB Atlas middleware for Hono

A MongoDB Atlas middleware for Hono

## Usage

```ts
// index.ts
import {Hono} from "hono";
import {mongoDBAtlas, IMongoDBAtlasOptions} from '@hono/packages/mongodb-atlas/src/index'

const ACPN = 'ACPN'

const options: IMongoDBAtlasOptions = {
   realmAppId: "mongodb-real-app-id",
   realmApiKey: "mongodb-real-api-key",
   defaultDatabase: "test",
   accessCollectionPropName: ACPN
}

const app = new Hono()
app.use('/', mongoDBAtlas(options))
app.get('/', async (c) => {
   // access collection 'users' at default database named 'test'
   const rs = await c.get(ACPN)('users').find()
   return c.json(rs)
})
app.get('/db2', async (c) => {
   // access collection 'users' at database 'db2'
   const rs = await c.get(ACPN)('users', 'db2').find()
   return c.json(rs)
})

export default app;
```

## Author

Thinh Vu <https://github.com/ThinhVu>

## License

MIT
