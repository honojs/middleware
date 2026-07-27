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
  'user-agent': z.string(),
})

const userSchema = z.strictObject({
  username: z
    .string()
    .max(10, 'Username cannot be longer than 10 characters')
    .regex(/^[\p{L}\p{N}_]+$/u, 'Username must contain only alphanumeric characters'),
  password: z.string().trim().min(4, 'Password must be at least 4 characters long'),
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
