import { z } from 'zod'

export const ErrorResponseSchema = z.object({
  error: z.string().describe('Error code identifier'),
  message: z.string().describe('Human-readable error description'),
})

export const UnauthorizedResponseSchema = z.object({
  error: z.string().describe('Error code, e.g. unauthorized'),
  message: z.string().describe('Details about the authentication failure'),
})

export const ForbiddenResponseSchema = z.object({
  error: z.string().describe('Error code, e.g. forbidden'),
  message: z.string().describe('Details about why access was denied'),
})
