import { type } from 'arktype'

const personJSONSchema = type({
  name: 'string',
  age: 'number',
})

const postJSONSchema = type({
  id: 'number',
  title: 'string',
})

const idJSONSchema = type({
  id: 'string',
})

const queryNameSchema = type({
  'name?': 'string',
})

const queryPaginationSchema = type({
  page: type('unknown').pipe((p) => Number(p)),
})

const querySortSchema = type({
  order: "'asc'|'desc'",
})

const headerSchema = type({
  'user-agent': 'string',
})

const userSchema = type({
  username: type('string')
    .atMostLength(10)
    .configure({ message: 'Username cannot be longer than 10 characters' })
    .matching(/^[\p{L}\p{N}_]+$/u)
    .configure({ message: 'Username must contain only alphanumeric characters' }),
  password: type.pipe(type.string, (s) => s.trim(), type.string.atLeastLength(4)),
})

export {
  headerSchema,
  idJSONSchema,
  personJSONSchema,
  postJSONSchema,
  queryNameSchema,
  queryPaginationSchema,
  querySortSchema,
  userSchema,
}
