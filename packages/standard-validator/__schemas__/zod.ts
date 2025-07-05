import { z } from 'zod'

const personJSONSchema = z.object({
  name: z.string(),
  age: z.number(),
})

const postJSONSchema = z.object({
  id: z.number(),
  title: z.string(),
})

const idJSONSchema = z.object({
  id: z.string(),
})

const queryNameSchema = z
  .object({
    name: z.string().optional(),
  })
  .optional()

const queryPaginationSchema = z.object({
  page: z.coerce.number(),
})

const querySortSchema = z.object({
  order: z.enum(['asc', 'desc']),
})

const headerSchema = z.object({
  'User-Agent': z.string(),
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
