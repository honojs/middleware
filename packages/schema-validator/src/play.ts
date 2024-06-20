import { Schema as S } from '@effect/schema'
const Age = S.NumberFromString


const User = S.Struct({
    username: S.NonEmpty,
    age: Age
})

// type User = S.Schema.Type<typeof User>

// const d = S.decodeUnknownSync(User)({ username: 'Ludwig', age: 3 })
const e = S.decodeUnknownEither(User)({ username: '日本語', age: 4 })




console.log(e)