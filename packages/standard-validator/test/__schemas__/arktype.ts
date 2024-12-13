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
  name: 'string|undefined',
})

const queryPaginationSchema = type({
  page: type('unknown').pipe((p) => Number(p)),
})

const querySortSchema = type({
  order: "'asc'|'desc'",
})

const headerSchema = type({
  'Content-Type': 'string',
  ApiKey: 'string',
  onlylowercase: 'string',
  ONLYUPPERCASE: 'string',
})

export {
  idJSONSchema,
  personJSONSchema,
  postJSONSchema,
  queryNameSchema,
  queryPaginationSchema,
  querySortSchema,
  headerSchema,
}
