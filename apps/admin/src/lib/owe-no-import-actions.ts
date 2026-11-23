"use server";

import { requirePanel } from "@/lib/panel-guard";
import { oweDeps } from "@/lib/owe-no";
import { OweDomainError } from "@027apps/owe-no/domain/service.js";
import {
  commitImport,
  importMappingOptions,
  previewImport,
} from "@027apps/owe-no/domain/importer.js";

/**
 * The panel's Splitwise wizard: preview, directory and commit. They return data
 * instead of redirecting because the wizard is a client component. Only the
 * group's creator may import (the domain enforces it); an admin who is not the
 * creator gets a stable code the wizard can explain.
 */
function codeOf(error: unknown): string {
  if (error instanceof OweDomainError) {
    const details = error.details as { code?: string } | undefined;
    return details?.code ?? error.code;
  }
  return "failed";
}

async function callerId(): Promise<string> {
  const panel = await requirePanel("admin");
  if ("denied" in panel) throw new Error("forbidden");
  return panel.user.id;
}

export async function importPreviewAction(groupId: string, csv: string) {
  try {
    const userId = await callerId();
    const { owe } = await oweDeps();
    return { ok: true as const, preview: await previewImport(owe, userId, groupId, csv) };
  } catch (error) {
    return { ok: false as const, code: codeOf(error) };
  }
}

export async function importIdentitiesAction(groupId: string) {
  try {
    const userId = await callerId();
    const { owe } = await oweDeps();
    return { ok: true as const, identities: await importMappingOptions(owe, userId, groupId) };
  } catch (error) {
    return { ok: false as const, code: codeOf(error) };
  }
}

/** A mapping choice: reuse a member, invite an account, or create a fictitious one. */
export type ImportChoice = { member_id?: string; user_id?: string; display_name: string };

/**
 * Turns the wizard's choices into what the domain expects: an id for a member
 * that already exists, and a name (with its account, if any) for one the import
 * must create inside its own transaction.
 */
function importPayload(choices: Record<string, ImportChoice>): {
  mapping?: Record<string, string>;
  newMembers?: Array<{ name: string; displayName?: string; userId?: string }>;
} {
  const mapping: Record<string, string> = {};
  const newMembers: Array<{ name: string; displayName?: string; userId?: string }> = [];
  for (const [name, choice] of Object.entries(choices)) {
    // A CSV name may point at a member that already exists under another
    // spelling; reuse it instead of creating a duplicate person.
    if (choice.member_id) {
      mapping[name] = choice.member_id;
      continue;
    }
    // A real account enters invited and is charged like a fictitious one
    // (owner's ruling, 2026-11-15); it inherits this balance when it accepts.
    newMembers.push({
      name,
      ...(choice.display_name && choice.display_name !== name
        ? { displayName: choice.display_name }
        : {}),
      ...(choice.user_id ? { userId: choice.user_id } : {}),
    });
  }
  return {
    ...(Object.keys(mapping).length > 0 ? { mapping } : {}),
    ...(newMembers.length > 0 ? { newMembers } : {}),
  };
}

export async function importCommitAction(
  groupId: string,
  csv: string,
  choices: Record<string, ImportChoice>,
  options: { confirmDuplicates?: boolean; reset?: boolean; idempotencyKey?: string } = {},
) {
  try {
    const userId = await callerId();
    const { owe } = await oweDeps();
    // The importer never invents ids: each unresolved name travels to the
    // domain, which creates (or joins) the member inside the import's own
    // transaction. A cancel or a failed commit leaves the group untouched.
    const result = await commitImport(owe, userId, groupId, csv, {
      ...importPayload(choices),
      confirmDuplicates: options.confirmDuplicates === true,
      ...(options.reset === true ? { reset: true } : {}),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    });
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, code: codeOf(error) };
  }
}
