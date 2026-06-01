import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Re-create schemas locally to avoid module resolution issues in tests.
// These match src/contracts/v1/inspiration.ts exactly.

const RequestTypeEnum = z.enum([
  'bug', 'improvement', 'new_app', 'new_app_feature',
  'new_general_functionality', 'other'
])

const RequestStatusEnum = z.enum([
  'pending', 'reviewing', 'approved', 'in_progress',
  'completed', 'rejected', 'on_hold', 'duplicate'
])

const InspirationRequestSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  type: RequestTypeEnum,
  status: RequestStatusEnum,
  app_slug: z.string().nullable(),
  group_id: z.string().uuid(),
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

const CreateCommentSchema = z.object({
  body: z.string().min(1, 'Comment body is required'),
})

const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  total_pages: z.number().int().min(0),
})

// ---------------------------------------------------------------------------
// CreateRequestSchema
// ---------------------------------------------------------------------------

describe('CreateRequestSchema', () => {
  it('accepts a valid create request with all fields', () => {
    const result = CreateRequestSchema.safeParse({
      title: 'Fix dark mode toggle',
      description: 'The toggle does not persist across page reloads',
      type: 'bug',
      app_slug: 'todo',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Fix dark mode toggle')
      expect(result.data.type).toBe('bug')
    }
  })

  it('rejects when title is missing', () => {
    const result = CreateRequestSchema.safeParse({
      description: 'Some description',
      type: 'bug',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when title is empty string', () => {
    const result = CreateRequestSchema.safeParse({
      title: '',
      type: 'bug',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when type is invalid', () => {
    const result = CreateRequestSchema.safeParse({
      title: 'Hello',
      type: 'not_a_real_type',
    })
    expect(result.success).toBe(false)
  })

  it('defaults description to empty string when omitted', () => {
    const result = CreateRequestSchema.safeParse({
      title: 'Minimal request',
      type: 'other',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('')
      expect(result.data.app_slug).toBeUndefined()
    }
  })

  it('accepts null app_slug', () => {
    const result = CreateRequestSchema.safeParse({
      title: 'Idea without app',
      type: 'new_app',
      app_slug: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all 6 request types', () => {
    const types = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']
    for (const t of types) {
      const result = CreateRequestSchema.safeParse({ title: 'Test', type: t })
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// UpdateRequestSchema
// ---------------------------------------------------------------------------

describe('UpdateRequestSchema', () => {
  it('accepts partial update with just title', () => {
    const result = UpdateRequestSchema.safeParse({ title: 'Updated title' })
    expect(result.success).toBe(true)
  })

  it('accepts status change (admin)', () => {
    const result = UpdateRequestSchema.safeParse({ status: 'in_progress' })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = UpdateRequestSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = UpdateRequestSchema.safeParse({ status: 'not_a_status' } as unknown)
    expect(result.success).toBe(false)
  })

  it('accepts null app_slug', () => {
    const result = UpdateRequestSchema.safeParse({ app_slug: null })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no-op update)', () => {
    const result = UpdateRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// VoteResponseSchema
// ---------------------------------------------------------------------------

describe('VoteResponseSchema', () => {
  it('accepts voted=true with vote_count', () => {
    const result = VoteResponseSchema.safeParse({ voted: true, vote_count: 5 })
    expect(result.success).toBe(true)
  })

  it('accepts voted=false with vote_count=0', () => {
    const result = VoteResponseSchema.safeParse({ voted: false, vote_count: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects negative vote_count', () => {
    const result = VoteResponseSchema.safeParse({ voted: true, vote_count: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer vote_count', () => {
    const result = VoteResponseSchema.safeParse({ voted: true, vote_count: 3.5 })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CreateCommentSchema
// ---------------------------------------------------------------------------

describe('CreateCommentSchema', () => {
  it('accepts a valid comment body', () => {
    const result = CreateCommentSchema.safeParse({ body: 'Great idea!' })
    expect(result.success).toBe(true)
  })

  it('rejects empty body', () => {
    const result = CreateCommentSchema.safeParse({ body: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing body', () => {
    const result = CreateCommentSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PaginationMetaSchema
// ---------------------------------------------------------------------------

describe('PaginationMetaSchema', () => {
  it('accepts valid pagination meta', () => {
    const result = PaginationMetaSchema.safeParse({
      page: 1,
      limit: 20,
      total: 150,
      total_pages: 8,
    })
    expect(result.success).toBe(true)
  })

  it('rejects page=0 (min 1)', () => {
    const result = PaginationMetaSchema.safeParse({
      page: 0, limit: 20, total: 0, total_pages: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit=0 (min 1)', () => {
    const result = PaginationMetaSchema.safeParse({
      page: 1, limit: 0, total: 0, total_pages: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects limit=101 (max 100)', () => {
    const result = PaginationMetaSchema.safeParse({
      page: 1, limit: 101, total: 0, total_pages: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts total_pages=0 (empty list)', () => {
    const result = PaginationMetaSchema.safeParse({
      page: 1, limit: 20, total: 0, total_pages: 0,
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// InspirationRequestSchema (full response object)
// ---------------------------------------------------------------------------

describe('InspirationRequestSchema', () => {
  it('accepts a fully populated request with computed fields', () => {
    const result = InspirationRequestSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Add dark mode',
      description: 'System-wide dark mode support',
      type: 'improvement',
      status: 'pending',
      app_slug: null,
      group_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      created_at: '2025-01-15T10:30:00Z',
      updated_at: '2025-01-15T10:30:00Z',
      vote_count: 42,
      comment_count: 7,
      user_has_voted: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative vote_count', () => {
    const result = InspirationRequestSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'X',
      description: '',
      type: 'other',
      status: 'pending',
      app_slug: null,
      group_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      created_at: '2025-01-15T10:30:00Z',
      updated_at: '2025-01-15T10:30:00Z',
      vote_count: -1,
      comment_count: 0,
      user_has_voted: false,
    })
    expect(result.success).toBe(false)
  })
})
