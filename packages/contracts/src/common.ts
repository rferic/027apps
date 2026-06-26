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

export const AuthHeadersSchema = z.object({
  authorization: z.string().optional(),
  'x-api-key': z.string().optional(),
}).refine(data => data.authorization || data['x-api-key'], {
  message: 'Either Authorization or X-API-Key header is required',
})
