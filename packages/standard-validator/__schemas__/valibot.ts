import { object, string, number, optional, pipe, unknown, transform, picklist, strictObject, maxLength, minLength, regex, trim } from 'valibot'

const personJSONSchema = object({
  name: string(),
  age: number(),
})

const postJSONSchema = object({
  id: number(),
  title: string(),
})

const idJSONSchema = object({
  id: string(),
})

const queryNameSchema = optional(
  object({
    name: optional(string()),
  })
)

const queryPaginationSchema = object({
  page: pipe(unknown(), transform(Number)),
})

const querySortSchema = object({
  order: picklist(['asc', 'desc']),
})

const headerSchema = object({
  'user-agent': string(),
})

const userSchema = strictObject({
  username: pipe(
    string(),
    maxLength(10, 'Username cannot be longer than 10 characters'),
    regex(/^[\p{L}\p{N}_]+$/u, 'Username must contain only alphanumeric characters'),
  ),
  password: pipe(
    string(),
    trim(),
    minLength(4, 'Password must be at least 4 characters long'),
  ),
});

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
