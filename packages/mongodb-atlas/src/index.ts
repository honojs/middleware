import type { Context, Next } from 'hono'
import * as Realm from 'realm-web'

interface Bindings {
   // MongoDB Realm Application ID
   REALM_APPID: string;
   REALM_API_KEY: string;
}

type Document = globalThis.Realm.Services.MongoDB.Document;

let App: Realm.App
let user
let client: globalThis.Realm.Services.MongoDB

const KEYS = {
   APP: 'mongodb-atlas-app',
   USER: 'mongodb-atlas-user',
   CLIENT: 'mongodb-atlas-client',
}

const dbCache: Record<string, globalThis.Realm.Services.MongoDBDatabase> = {}
const collectionCache: Record<string, globalThis.Realm.Services.MongoDB.MongoDBCollection<Document>> = {}

export async function mongoDBAtlas(c: Context, next: Next) {
   if (App) {
      await next()
      return
   }

   App = App || new Realm.App(c.env.REALM_APPID)
   user = await App.logIn(Realm.Credentials.apiKey(c.env.REALM_API_KEY))
   client = user.mongoClient('mongodb-atlas')

   c.set(KEYS.APP, App)
   c.set(KEYS.USER, user)
   c.set(KEYS.CLIENT, client)

   await next()
}

export function getApp(c: Context) {
   return c.get(KEYS.APP)
}

export function getUser(c: Context) {
   return c.get(KEYS.USER)
}

export function getClient(c: Context): globalThis.Realm.Services.MongoDB {
   return c.get(KEYS.CLIENT)
}

export function getDb(c: Context, name: string): globalThis.Realm.Services.MongoDBDatabase {
   if (!dbCache[name])
      dbCache[name] = getClient(c).db(name)
   return dbCache[name]
}

export function getCollection<T extends Document>(c: Context, dbName: string, collectionName: string)
   : globalThis.Realm.Services.MongoDB.MongoDBCollection<T> {
   if (!collectionCache[collectionName])
      collectionCache[collectionName] = getDb(c, dbName).collection<T>(collectionName)
   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
   // @ts-ignore
   return collectionCache[collectionName]
}
