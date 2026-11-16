"use server";

import { requirePanel } from "@/lib/panel-guard";
import { oweDeps } from "@/lib/owe-no";
import { OweDomainError } from "@027apps/owe-no/domain/service.js";
import {
  commitImport,
  importIdentities,
  previewImport,
} from "@027apps/owe-no/domain/importer.js";
import { addMember } from "@027apps/owe-no/domain/service.js";

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
    return { ok: true as const, identities: await importIdentities(owe, userId, groupId) };
  } catch (error) {
    return { ok: false as const, code: codeOf(error) };
  }
}

export type ImportChoice = { user_id?: string | null; display_name: string };

export async function importCommitAction(
  groupId: string,
  csv: string,
  choices: Record<string, ImportChoice>,
  options: { confirmDuplicates?: boolean; reset?: boolean } = {},
) {
  try {
    const userId = await callerId();
    const { owe } = await oweDeps();
    // The importer never invents ids: each unresolved name becomes (or joins) a
    // member first, exactly like the app does.
    const mapping: Record<string, string> = {};
    for (const [name, choice] of Object.entries(choices)) {
      // A real account enters invited and is charged like a fictitious one
      // (owner's ruling, 2026-11-15); it inherits this balance when it accepts.
      const member = await addMember(owe, userId, groupId, {
        displayName: choice.display_name || name,
        ...(choice.user_id ? { inviteeId: choice.user_id } : {}),
      });
      mapping[name] = member.id;
    }
    const result = await commitImport(owe, userId, groupId, csv, {
      mapping,
      confirmDuplicates: options.confirmDuplicates === true,
      ...(options.reset === true ? { reset: true } : {}),
    });
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, code: codeOf(error) };
  }
}
