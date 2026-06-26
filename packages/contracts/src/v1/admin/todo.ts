import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../../common'

const c = initContract()

const TodoItemSchema = z.object({
  id: z.number().describe('Todo item ID'),
  title: z.string().describe('Todo title'),
  completed: z.boolean().describe('Whether the todo is completed'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  user_id: z.string().describe('Owner user UUID'),
  group_id: z.string().describe('Group UUID'),
  visibility: z.string().describe('Visibility: public, private'),
})

export const adminTodoContract = c.router({
  listAdminTodos: {
    method: 'GET',
    path: '/api/v1/admin/apps/todo',
    summary: 'List all todo items (admin)',
    description: 'Returns all todo items across all groups. Requires admin role.',
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
