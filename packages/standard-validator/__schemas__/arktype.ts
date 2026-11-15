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
  '+': 'reject',
})

const petSchema = type({
  name: 'string > 0',
  'owner/id': 'string',
  tags: 'string[]',
})

const petIdSchema = type({
  id: 'string | number',
})

const tagsQuerySchema = type({
  tags: '(string >= 2)[]',
})

const ownerFormSchema = type({
  'owner/id': 'string >= 2',
})

export {
  headerSchema,
  idJSONSchema,
  ownerFormSchema,
  personJSONSchema,
  petIdSchema,
  petSchema,
  postJSONSchema,
  queryNameSchema,
  queryPaginationSchema,
  querySortSchema,
  tagsQuerySchema,
  userSchema,
}
