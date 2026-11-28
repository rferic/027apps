import { z } from "zod";

/**
 * Edge validation for the NotNow endpoints (spec §6). Lengths are generous here
 * and exact in the domain, which counts code points: an emoji is one character.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const period = z.enum(["infinite", "weekly", "monthly", "yearly"]);

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    timezone: z.string().min(1).max(64).optional(),
    power_enabled: z.boolean().optional(),
    power_period: period.optional(),
  })
  .strict();

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(240).optional(),
    timezone: z.string().min(1).max(64).optional(),
    power_enabled: z.boolean().optional(),
    power_period: period.optional(),
  })
  .strict();

export const addMemberSchema = z.object({ user_id: z.uuid() }).strict();

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    notes: z.string().max(4000).nullish(),
    category_id: z.uuid().nullish(),
    power: z.number().int().min(1).max(5).nullish(),
    assignee_id: z.uuid().nullish(),
    due_on: isoDate.nullish(),
    recurrence: z.enum(["none", "weekly", "monthly", "yearly"]).optional(),
    keep_assignee: z.boolean().optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    notes: z.string().max(4000).nullish(),
    category_id: z.uuid().nullish(),
    power: z.number().int().min(1).max(5).nullish(),
    due_on: isoDate.nullish(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "nothing to update" });

export const taskQuerySchema = z
  .object({
    state: z.enum(["pending", "done", "all"]).optional(),
    category: z.uuid().optional(),
    assignee: z.literal("me").optional(),
    overdue: z.enum(["1", "true"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().max(200).optional(),
  })
  .strict();

export const requestQuerySchema = z
  .object({ direction: z.enum(["incoming", "outgoing"]).default("incoming") })
  .strict();
