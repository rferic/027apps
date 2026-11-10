"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert } from "@/components/ui/form";
import { activateModule, deactivateModule, uninstallModule } from "@/lib/module-mutations";
import type { MutationFailure, MutationResult } from "@/lib/mutation-result";
import type { ModuleState } from "@/lib/panel-modules";

/** What the uninstall dialog does with one Core answer. */
export type UninstallOutcome =
  | { kind: "success" }
  | { kind: "grants" }
  | { kind: "error"; failure: MutationFailure };

/**
 * The double confirmation belongs to the active-grants gate only. Any other
 * `409` — an unreverted migration, for instance — is a plain failure, so the
 * dialog never offers "Uninstall anyway" for a reason a retry cannot fix.
 */
export function uninstallOutcome(result: MutationResult, confirm: boolean): UninstallOutcome {
  if (result.ok) return { kind: "success" };
  if (!confirm && result.code === "conflict" && result.details?.code === "grants_active") {
    return { kind: "grants" };
  }
  return { kind: "error", failure: result };
}

/**
 * Uninstall, super_admin only (the Core checks again). The Core answers
 * `409 conflict` while the module has grants: the dialog then asks a second,
 * explicit time and only the retry carries `confirm: true`.
 */
function ModuleUninstall({
  moduleKey,
  name,
  messages,
}: {
  moduleKey: string;
  name: string;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);
  const [phase, setPhase] = useState<"confirm" | "grants">("confirm");
  const confirmingGrants = phase === "grants";

  async function handleUninstall(confirm: boolean) {
    setPending(true);
    setError(null);
    const result = await uninstallModule(moduleKey, confirm);
    setPending(false);
    const outcome = uninstallOutcome(result, confirm);
    if (outcome.kind === "success") {
      dialogRef.current?.close();
      router.push("/modules");
      router.refresh();
      return;
    }
    if (outcome.kind === "grants") {
      setPhase("grants");
      return;
    }
    setError(outcome.failure);
  }

  function open() {
    setPhase("confirm");
    setError(null);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <Button type="button" variant="destructive" className="min-h-11" onClick={open} disabled={pending}>
        {t("Uninstall", messages)}
      </Button>

      <Dialog
        labelledBy={`module-uninstall-title-${moduleKey}`}
        ref={dialogRef}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onBackdropClick={pending ? undefined : () => dialogRef.current?.close()}
      >
        <h2 id={`module-uninstall-title-${moduleKey}`} className="text-sm font-semibold">
          {confirmingGrants
            ? t("This module still has active grants.", messages)
            : t("Uninstall {name}?", messages, { name })}
        </h2>
        {confirmingGrants ? (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Members and categories that hold this module lose access immediately.", messages)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Uninstall it anyway?", messages)}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("The module, its settings and its data are removed for good.", messages)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("This cannot be undone.", messages)}</p>
          </>
        )}

        {error && (
          <FormAlert
            className="mt-3"
            message={t("We couldn't uninstall the module.", messages)}
            code={error.code}
            requestId={error.requestId}
            messages={messages}
          />
        )}

        <FormActions className="mt-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={() => handleUninstall(confirmingGrants)}
            disabled={pending}
          >
            {pending
              ? t("Uninstalling…", messages)
              : confirmingGrants
                ? t("Uninstall anyway", messages)
                : t("Uninstall module", messages)}
          </Button>
        </FormActions>
      </Dialog>
    </>
  );
}

/**
 * Module lifecycle actions. Deactivating keeps every row and only stops the
 * module from serving, so it is not confirmed; uninstalling reverses the
 * manifest and deletes the Core rows, so it is.
 */
export function ModuleActions({
  moduleKey,
  name,
  state,
  canUninstall,
  messages,
}: {
  moduleKey: string;
  name: string;
  state: ModuleState;
  /** Only a super_admin may uninstall; the Core enforces it again. */
  canUninstall: boolean;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ failure: MutationFailure; message: string } | null>(null);
  const deactivating = state === "active";

  async function handleToggle() {
    setPending(true);
    setError(null);
    const result = deactivating
      ? await deactivateModule(moduleKey)
      : await activateModule(moduleKey);
    setPending(false);
    if (!result.ok) {
      setError({
        failure: result,
        message: deactivating
          ? t("We couldn't deactivate the module.", messages)
          : t("We couldn't activate the module.", messages),
      });
      return;
    }
    router.refresh();
  }

  return (
    <section
      aria-labelledby="module-actions-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-actions-title" className="text-sm font-semibold">
        {t("Actions", messages)}
      </h2>
      <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
        <Button variant="secondary" className="min-h-11" onClick={handleToggle} disabled={pending}>
          {deactivating ? t("Deactivate", messages) : t("Activate", messages)}
        </Button>
        {canUninstall && <ModuleUninstall moduleKey={moduleKey} name={name} messages={messages} />}
      </div>
      {error && (
        <FormAlert
          message={error.message}
          code={error.failure.code}
          requestId={error.failure.requestId}
          messages={messages}
        />
      )}
    </section>
  );
}
