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
  username: type('string.alphanumeric <= 10'),
  password: type('string >= 4').pipe((value) => value.trim()),
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
