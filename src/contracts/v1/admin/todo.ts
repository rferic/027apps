import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../../common'

const c = initContract()

const TodoItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
  created_at: z.string(),
  user_id: z.string(),
  group_id: z.string(),
  visibility: z.string(),
})

export const adminTodoContract = c.router({
  listAdminTodos: {
    method: 'GET',
    path: '/api/v1/admin/apps/todo',
    responses: {
      200: z.array(TodoItemSchema),
      401: UnauthorizedResponseSchema,
      403: ForbiddenResponseSchema,
      500: ErrorResponseSchema,
    },
    headers: z.object({
      authorization: z.string().startsWith('Bearer '),
    }),
  },
})
