import type { Context, Next } from 'hono'
import * as Realm from 'realm-web'

import RealmServices = globalThis.Realm.Services
import MongoDB = RealmServices.MongoDB

type MongoDBDatabase = RealmServices.MongoDBDatabase
type Document = MongoDB.Document

let App: Realm.App
let user
let client: MongoDB

const KEYS = {
   APP: 'mongodb-atlas-app',
   USER: 'mongodb-atlas-user',
   CLIENT: 'mongodb-atlas-client',
}

const dbCache: Record<string, MongoDBDatabase> = {}


export interface IMongoDBAtlasOptions {
   realmAppId: string;
   realmApiKey: string;
}

export function mongoDBAtlas(options: IMongoDBAtlasOptions) {
   if (!options.realmAppId || !options.realmApiKey)
      throw new Error('Missing Realm App ID or API Key')

   return async function(c: Context, next: Next) {
      if (App) {
         await next()
         return
      }

      App = App || new Realm.App(options.realmAppId)
      user = await App.logIn(Realm.Credentials.apiKey(options.realmApiKey))
      client = user.mongoClient('mongodb-atlas')

      c.set(KEYS.APP, App)
      c.set(KEYS.USER, user)
      c.set(KEYS.CLIENT, client)

      await next()
   }
}

export function getApp(c: Context) {
   return c.get(KEYS.APP)
}

export function getUser(c: Context) {
   return c.get(KEYS.USER)
}

export function getClient(c: Context): MongoDB {
   return c.get(KEYS.CLIENT)
}

export function getDb(c: Context, name: string): MongoDBDatabase {
   if (!dbCache[name])
      dbCache[name] = getClient(c).db(name)
   return dbCache[name]
}

const collectionCache: Record<string, MongoDB.MongoDBCollection<Document>> = {}
export function getCollection<T extends Document>(c: Context, dbName: string, collectionName: string): MongoDB.MongoDBCollection<T> {
   if (!collectionCache[collectionName])
      collectionCache[collectionName] = getDb(c, dbName).collection(collectionName)
   return collectionCache[collectionName] as MongoDB.MongoDBCollection<T>
}
