import { z } from "zod";

/**
 * OweNo request bodies. They mirror `packages/owe-no/src/requests.ts`; the Core
 * cannot import a module package (a module depends on the Core, not the other
 * way round), so the published contract lives here and the module owns the
 * runtime validation.
 */
export const oweCreateGroup = z
  .object({ name: z.string().trim().min(1).max(80), currency: z.string().regex(/^[A-Z]{3}$/) })
  .strict();

export const oweAddMember = z
  .object({
    display_name: z.string().trim().min(1).max(80),
    invitee_id: z.uuid().optional(),
  })
  .strict();

export const oweCreateMovement = z
  .object({
    kind: z.enum(["expense", "settlement"]),
    description: z.string().trim().min(1).max(200),
    amount_minor: z.number().int().positive(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paid_by: z.uuid(),
    category_id: z.uuid().nullable().optional(),
    participants: z
      .array(
        z.object({ member_id: z.uuid(), amount_minor: z.number().int().min(0).optional() }).strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const oweImportPreview = z
  .object({ csv: z.string().min(1).max(2 * 1024 * 1024) })
  .strict();

export const oweImportCommit = z
  .object({
    csv: z.string().min(1).max(2 * 1024 * 1024),
    mapping: z.record(z.string(), z.uuid()).optional(),
    confirm_duplicates: z.boolean().optional(),
  })
  .strict();
