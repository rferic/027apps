import { z } from "zod";

/** Edge validation for the OweNo endpoints; the service re-checks invariants. */
export const createGroupSchema = z
  .object({ name: z.string().trim().min(1).max(80), currency: z.string().regex(/^[A-Z]{3}$/) })
  .strict();

export const addMemberSchema = z
  .object({
    display_name: z.string().trim().min(1).max(80),
    invitee_id: z.uuid().optional(),
    active: z.boolean().optional(),
  })
  .strict();

const shareSchema = z
  .object({ member_id: z.uuid(), amount_minor: z.number().int().min(0).optional() })
  .strict();

export const createMovementSchema = z
  .object({
    kind: z.enum(["expense", "settlement"]),
    description: z.string().trim().min(1).max(200),
    amount_minor: z.number().int().positive(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paid_by: z.uuid(),
    category_id: z.uuid().nullable().optional(),
    participants: z.array(shareSchema).min(1).max(200),
  })
  .strict();

export type CreateMovementBody = z.infer<typeof createMovementSchema>;

export const importPreviewSchema = z.object({ csv: z.string().min(1).max(2 * 1024 * 1024) }).strict();

export const importCommitSchema = z
  .object({
    csv: z.string().min(1).max(2 * 1024 * 1024),
    mapping: z.record(z.string(), z.uuid()).optional(),
    confirm_duplicates: z.boolean().optional(),
  })
  .strict();
