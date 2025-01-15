import { object, string, number, optional, pipe, unknown, transform, picklist } from 'valibot'

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
  'Content-Type': string(),
  ApiKey: string(),
  onlylowercase: string(),
  ONLYUPPERCASE: string(),
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
