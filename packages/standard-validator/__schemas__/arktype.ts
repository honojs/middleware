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

export {
  headerSchema,
  idJSONSchema,
  personJSONSchema,
  postJSONSchema,
  queryNameSchema,
  queryPaginationSchema,
  querySortSchema,
}
