# MongoDB Atlas middleware for Hono

**WIP**

## Usage

```ts
import { mongoDBAtlas } from '@hono/mongodb-atlas'
import { Hono } from 'hono'

const app = new Hono()

app.use('*', mongoDBAtlas())
app.get('/', async (c) => {
   const db = c.get('mongodb-atlas').db('foo') 
   const insertedDoc = await db.collection('bar').insertOne({ foo: 'bar' })
   c.json(insertedDoc)
})

export default app
```

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
