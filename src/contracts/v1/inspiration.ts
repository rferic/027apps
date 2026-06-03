import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../common'

const c = initContract()

// ---- Enums ----

const RequestTypeEnum = z.enum([
  'bug', 'improvement', 'new_app', 'new_app_feature',
  'new_general_functionality', 'other'
])

const RequestStatusEnum = z.enum([
  'pending', 'reviewing', 'approved', 'in_progress',
  'completed', 'rejected', 'on_hold', 'duplicate'
])

// ---- Schemas ----

const InspirationRequestSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  type: RequestTypeEnum,
  status: RequestStatusEnum,
  app_slug: z.string().nullable(),
  // group_id was removed from schema (global ideas, not scoped to a group)
  // group_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  vote_count: z.number().int().min(0),
  comment_count: z.number().int().min(0),
  user_has_voted: z.boolean(),
})

const CreateRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  type: RequestTypeEnum,
  app_slug: z.string().nullable().optional(),
})

const UpdateRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: RequestTypeEnum.optional(),
  app_slug: z.string().nullable().optional(),
  status: RequestStatusEnum.optional(),
})

const VoteResponseSchema = z.object({
  voted: z.boolean(),
  vote_count: z.number().int().min(0),
})

const CommentSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  user_id: z.string().uuid(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  user: z.object({
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }).nullable(),
})

const CreateCommentSchema = z.object({
  body: z.string().min(1, 'Comment body is required'),
})

const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  total_pages: z.number().int().min(0),
})

const PaginatedRequestsSchema = z.object({
  data: z.array(InspirationRequestSchema),
  pagination: PaginationMetaSchema,
})

const PaginatedCommentsSchema = z.object({
  data: z.array(CommentSchema),
  pagination: PaginationMetaSchema,
})

// ---- Contract ----

export const inspirationContract = c.router({
  listRequests: {
    method: 'GET',
    path: '/api/v1/:groupSlug/apps/inspiration',
    query: z.object({
      status: z.string().optional(),
      type: z.string().optional(),
      search: z.string().optional(),
      sort: z.enum(['newest', 'oldest', 'most_supported', 'most_commented']).optional(),
      app_slug: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
    responses: {
      200: PaginatedRequestsSchema,
      401: UnauthorizedResponseSchema,
    },
    summary: 'List inspiration requests with filters and pagination',
  },
  createRequest: {
    method: 'POST',
    path: '/api/v1/:groupSlug/apps/inspiration',
    body: CreateRequestSchema,
    responses: {
      201: InspirationRequestSchema,
      400: ErrorResponseSchema,
      401: UnauthorizedResponseSchema,
      422: ErrorResponseSchema,
    },
    summary: 'Create a new inspiration request',
  },
  updateRequest: {
    method: 'PUT',
    path: '/api/v1/:groupSlug/apps/inspiration/:id',
    body: UpdateRequestSchema,
    responses: {
      200: InspirationRequestSchema,
      403: ForbiddenResponseSchema,
      404: ErrorResponseSchema,
      422: ErrorResponseSchema,
    },
    summary: 'Update a request (creator: title/description; admin: also status)',
  },
  deleteRequest: {
    method: 'DELETE',
    path: '/api/v1/:groupSlug/apps/inspiration/:id',
    responses: {
      200: z.object({ deleted: z.boolean() }),
      403: ForbiddenResponseSchema,
      404: ErrorResponseSchema,
    },
    summary: 'Delete a request (creator or admin only)',
  },
  toggleVote: {
    method: 'POST',
    path: '/api/v1/:groupSlug/apps/inspiration/:id/vote',
    body: c.noBody(),
    responses: {
      200: VoteResponseSchema,
      400: ErrorResponseSchema,
      401: UnauthorizedResponseSchema,
      404: ErrorResponseSchema,
    },
    summary: 'Toggle vote on a request (add or remove support)',
  },
  listComments: {
    method: 'GET',
    path: '/api/v1/:groupSlug/apps/inspiration/:id/comments',
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
    responses: {
      200: PaginatedCommentsSchema,
      401: UnauthorizedResponseSchema,
      404: ErrorResponseSchema,
    },
    summary: 'List comments for a request with pagination',
  },
  createComment: {
    method: 'POST',
    path: '/api/v1/:groupSlug/apps/inspiration/:id/comments',
    body: CreateCommentSchema,
    responses: {
      201: CommentSchema,
      400: ErrorResponseSchema,
      401: UnauthorizedResponseSchema,
      404: ErrorResponseSchema,
      422: ErrorResponseSchema,
    },
    summary: 'Add a comment to a request',
  },
})
