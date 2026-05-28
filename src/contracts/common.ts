import { z } from 'zod'

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})

export const UnauthorizedResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})

export const ForbiddenResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})
