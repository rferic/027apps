"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Caller } from "@027apps/core/api/types.js";
import { oweDeps } from "@/lib/owe-no";
import { requirePanel } from "@/lib/panel-guard";
import { OweDomainError } from "@027apps/owe-no/domain/service.js";
import {
  adminAddMember,
  adminCreateGroup,
  adminCreateMovement,
  adminDeleteMovement,
  adminLinkMember,
  adminRemoveMember,
  adminSetArchived,
  adminUpdateMovement,
} from "@027apps/owe-no/domain/admin.js";

/**
 * The panel writes OweNo as an administrator (D26). Each action repeats the
 * panel gate — an action is a public endpoint — and turns a domain refusal into
 * a code in the URL, never into a stack trace. The forms are native POSTs, so
 * the module needs no client bundle to work.
 */
const GROUP = "/panel/owe-no/groups";

function adminCaller(user: { id: string; role: string }): Caller {
  if (user.role !== "admin" && user.role !== "super_admin") {
    redirect(`${GROUP}?error=forbidden`);
  }
  return { kind: "session", userId: user.id, role: user.role };
}

function fail(code: string, groupId?: string, extra?: Record<string, string>): never {
  const params = new URLSearchParams({ error: code });
  if (groupId) params.set("group", groupId);
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  redirect(`${GROUP}?${params.toString()}`);
}

/** Domain codes are stable; anything else is a generic refusal. */
function errorCode(error: unknown): string {
  if (error instanceof OweDomainError) {
    const details = error.details as { code?: string } | undefined;
    return details?.code ?? error.code;
  }
  return "failed";
}

async function gate(): Promise<Caller> {
  const panel = await requirePanel("admin");
  if ("denied" in panel) redirect(`${GROUP}?error=forbidden`);
  return adminCaller(panel.user);
}

function refresh(groupId?: string): never {
  revalidatePath("/panel/owe-no");
  revalidatePath(GROUP);
  redirect(groupId ? `${GROUP}?group=${encodeURIComponent(groupId)}` : GROUP);
}

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export async function createGroupAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    currency: String(formData.get("currency") ?? "EUR").toUpperCase(),
  });
  if (!parsed.success) fail("validation_failed", undefined, { new: "1" });
  let created: string | undefined;
  try {
    const { owe } = await oweDeps();
    const group = await adminCreateGroup(owe, caller, parsed.data);
    created = group.id;
  } catch (error) {
    fail(errorCode(error), undefined, { new: "1" });
  }
  // `redirect` throws; it must run outside the try or the catch would eat it.
  refresh(created);
}

export async function archiveGroupAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const groupId = String(formData.get("group") ?? "");
  const archived = formData.get("archived") === "true";
  if (!groupId) fail("validation_failed");
  try {
    const { owe } = await oweDeps();
    await adminSetArchived(owe, caller, groupId, archived);
  } catch (error) {
    fail(errorCode(error), groupId);
  }
  refresh(groupId);
}

const addMemberSchema = z.object({
  group: z.uuid(),
  display_name: z.string().trim().min(1).max(80),
  user_id: z.uuid().optional(),
});

export async function addMemberAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = addMemberSchema.safeParse({
    group: formData.get("group"),
    display_name: formData.get("display_name"),
    user_id: String(formData.get("user_id") ?? "") || undefined,
  });
  if (!parsed.success) {
    fail("validation_failed", String(formData.get("group") ?? ""), { view: "member" });
  }
  try {
    const { owe } = await oweDeps();
    await adminAddMember(owe, caller, parsed.data.group, {
      displayName: parsed.data.display_name,
      userId: parsed.data.user_id ?? null,
    });
  } catch (error) {
    fail(errorCode(error), parsed.data.group, { view: "member" });
  }
  refresh(parsed.data.group);
}

const linkMemberSchema = z.object({ group: z.uuid(), member: z.uuid(), user_id: z.uuid() });

export async function linkMemberAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = linkMemberSchema.safeParse({
    group: formData.get("group"),
    member: formData.get("member"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) {
    fail("validation_failed", String(formData.get("group") ?? ""), { view: "link" });
  }
  try {
    const { owe } = await oweDeps();
    await adminLinkMember(owe, caller, parsed.data.group, parsed.data.member, parsed.data.user_id);
  } catch (error) {
    fail(errorCode(error), parsed.data.group, {
      view: "link",
      member: parsed.data.member,
    });
  }
  refresh(parsed.data.group);
}

const memberActionSchema = z.object({ group: z.uuid(), member: z.uuid() });

export async function removeMemberAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = memberActionSchema.safeParse({
    group: formData.get("group"),
    member: formData.get("member"),
  });
  if (!parsed.success) fail("validation_failed", String(formData.get("group") ?? ""));
  try {
    const { owe } = await oweDeps();
    await adminRemoveMember(owe, caller, parsed.data.group, parsed.data.member);
  } catch (error) {
    fail(errorCode(error), parsed.data.group);
  }
  refresh(parsed.data.group);
}

const movementSchema = z.object({
  group: z.uuid(),
  kind: z.enum(["expense", "settlement"]),
  description: z.string().trim().min(1).max(200),
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paid_by: z.uuid(),
  mode: z.enum(["equal", "exact"]),
  participants: z.array(z.uuid()).min(1),
  exact_amounts: z.record(z.string(), z.string()).default({}),
  category_id: z.uuid().optional(),
  movement: z.uuid().optional(),
});

/** "12,34" or "12.34" into cents; null when it is not a positive amount. */
function cents(raw: string): number | null {
  const normalized = raw.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100);
  return value > 0 ? value : null;
}

function movementInput(formData: FormData) {
  const mode = formData.get("mode") === "exact" ? "exact" : "equal";
  const participants = formData.getAll("participants").map(String);
  const exact: Record<string, string> = {};
  for (const memberId of participants) {
    const value = formData.get(`amount_${memberId}`);
    if (typeof value === "string" && value.trim() !== "") exact[memberId] = value;
  }
  return {
    group: formData.get("group"),
    kind: formData.get("kind"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    occurred_on: formData.get("occurred_on"),
    paid_by: formData.get("paid_by"),
    mode,
    participants,
    exact_amounts: exact,
    category_id: String(formData.get("category_id") ?? "") || undefined,
    movement: String(formData.get("movement") ?? "") || undefined,
  };
}

export async function saveMovementAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = movementSchema.safeParse(movementInput(formData));
  if (!parsed.success) {
    fail("validation_failed", String(formData.get("group") ?? ""), { view: "movement" });
  }
  const data = parsed.data;
  const amount = cents(data.amount);
  if (amount === null) fail("validation_failed", data.group, { view: "movement" });

  const shares =
    data.mode === "exact"
      ? data.participants.map((memberId) => {
          const value = cents(data.exact_amounts[memberId] ?? "0");
          return { memberId, amount_minor: value ?? 0 };
        })
      : data.participants.map((memberId) => ({ memberId }));

  const input = {
    kind: data.kind,
    description: data.description,
    amount_minor: amount,
    occurred_on: data.occurred_on,
    paid_by: data.paid_by,
    category_id: data.category_id ?? null,
    participants: shares,
  };

  try {
    const { owe } = await oweDeps();
    if (data.movement) {
      await adminUpdateMovement(owe, caller, data.group, data.movement, input);
    } else {
      await adminCreateMovement(owe, caller, data.group, input);
    }
  } catch (error) {
    fail(errorCode(error), data.group, {
      view: "movement",
      ...(data.movement ? { edit: data.movement } : {}),
    });
  }
  refresh(data.group);
}

export async function deleteMovementAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = z
    .object({ group: z.uuid(), movement: z.uuid() })
    .safeParse({ group: formData.get("group"), movement: formData.get("movement") });
  if (!parsed.success) fail("validation_failed", String(formData.get("group") ?? ""));
  try {
    const { owe } = await oweDeps();
    await adminDeleteMovement(owe, caller, parsed.data.group, parsed.data.movement);
  } catch (error) {
    fail(errorCode(error), parsed.data.group);
  }
  refresh(parsed.data.group);
}

const settleSchema = z.object({
  group: z.uuid(),
  from: z.uuid(),
  to: z.uuid(),
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(200).default("Settlement"),
});

/** One tap per transfer of the plan, or a manual payment, becomes a settlement. */
export async function settleAction(formData: FormData): Promise<void> {
  const caller = await gate();
  const parsed = settleSchema.safeParse({
    group: formData.get("group"),
    from: formData.get("from"),
    to: formData.get("to"),
    amount: formData.get("amount"),
    occurred_on: formData.get("occurred_on"),
    description: String(formData.get("description") ?? "Settlement"),
  });
  if (!parsed.success) {
    fail("validation_failed", String(formData.get("group") ?? ""), { view: "settle" });
  }
  const amount = cents(parsed.data.amount);
  if (amount === null) fail("validation_failed", parsed.data.group, { view: "settle" });

  try {
    const { owe } = await oweDeps();
    await adminCreateMovement(owe, caller, parsed.data.group, {
      kind: "settlement",
      description: parsed.data.description,
      amount_minor: amount,
      occurred_on: parsed.data.occurred_on,
      paid_by: parsed.data.from,
      participants: [{ memberId: parsed.data.to, amount_minor: amount }],
    });
  } catch (error) {
    fail(errorCode(error), parsed.data.group, { view: "settle" });
  }
  refresh(parsed.data.group);
}
