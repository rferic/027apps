"use client";

import { useState, useTransition } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import type { DemoStatus } from "@027apps/core/demo/service.js";
import {
  clearDemoAction,
  seedDemoAction,
  type DemoActionState,
} from "@/app/(panel)/panel/modules/[key]/settings/demo-actions";
import { Button } from "@/components/ui/button";

function failureLabel(reason: Extract<DemoActionState, { ok: false }>["reason"], messages: TranslationMap): string {
  switch (reason) {
    case "forbidden":
      return t("You do not have permission to do that.", messages);
    case "disabled":
      return t("Demo data is turned off in the instance settings.", messages);
    case "production":
      return t("Demo data is refused in production.", messages);
    case "linked":
      return t("A module still holds demo data; clear it first.", messages);
    default:
      return t("Something went wrong on the server.", messages);
  }
}

/** Install, and a two-step clear: the dataset is shared by every module. */
function DemoActions({
  demo,
  pending,
  confirming,
  messages,
  onSeed,
  onAskClear,
  onConfirmClear,
  onCancelClear,
}: {
  demo: DemoStatus;
  pending: boolean;
  confirming: boolean;
  messages: TranslationMap;
  onSeed: () => void;
  onAskClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="min-h-9" onClick={onSeed} disabled={pending}>
          {pending ? t("Working…", messages) : t("Install demo data", messages)}
        </Button>
        {confirming ? (
          <>
            <Button
              type="button"
              variant="destructive"
              className="min-h-9"
              onClick={onConfirmClear}
              disabled={pending}
            >
              {t("Confirm", messages)}
            </Button>
            <Button type="button" variant="ghost" className="min-h-9" onClick={onCancelClear}>
              {t("Cancel", messages)}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="min-h-9"
            onClick={onAskClear}
            disabled={pending || !demo.seeded}
          >
            {t("Clear demo data", messages)}
          </Button>
        )}
      </div>
      {confirming ? (
        <p className="text-xs text-destructive">
          {t(
            "This removes the demo members, the category and the invitation. It cannot be undone.",
            messages,
          )}
        </p>
      ) : null}
    </>
  );
}

/** What the last action did: a failure, or the outcome with the removed count. */
function DemoOutcome({
  saved,
  cleared,
  failure,
  messages,
}: {
  saved: DemoActionState | null;
  cleared: number | null;
  failure: DemoActionState | null;
  messages: TranslationMap;
}) {
  if (failure && !failure.ok) {
    return (
      <p role="alert" className="text-xs font-semibold text-destructive">
        {failureLabel(failure.reason, messages)}
      </p>
    );
  }
  if (!saved?.ok) return null;
  return (
    <p role="status" className="text-xs font-semibold text-muted-foreground">
      {saved.demo.seeded
        ? t("Demo data installed.", messages)
        : t("Demo data cleared.", messages)}
      {cleared !== null ? ` · ${cleared} ${t("members", messages)}` : null}
    </p>
  );
}

/** Presentational half: the counts, both buttons and the last message. */
export function DemoCardView({
  demo,
  pending,
  failure,
  saved,
  cleared,
  confirming,
  messages,
  onSeed,
  onAskClear,
  onConfirmClear,
  onCancelClear,
}: {
  demo: DemoStatus;
  pending: boolean;
  failure: DemoActionState | null;
  saved: DemoActionState | null;
  /** Members removed by the last clear, or `null` when it was not a clear. */
  cleared: number | null;
  confirming: boolean;
  messages: TranslationMap;
  onSeed: () => void;
  onAskClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
}) {
  return (
    <section
      aria-labelledby="module-demo-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-demo-title" className="text-sm font-semibold">
        {t("Demo data", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t(
          "Sample members, categories and one invitation, plus whatever each module seeds. No email is sent.",
          messages,
        )}
      </p>
      <p className="text-xs font-semibold">
        {demo.seeded
          ? t("Demo data installed", messages)
          : t("Demo data not installed", messages)}
        {" · "}
        {demo.members} {t("members", messages)}
      </p>
      {demo.modules.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {demo.modules.map((module) => (
            <li key={module.module_key} className="flex items-center justify-between gap-2">
              <code className="font-mono text-[11px]">{module.module_key}</code>
              <code className="text-[11px]">{JSON.stringify(module.result)}</code>
            </li>
          ))}
        </ul>
      ) : null}
      <DemoActions
        demo={demo}
        pending={pending}
        confirming={confirming}
        messages={messages}
        onSeed={onSeed}
        onAskClear={onAskClear}
        onConfirmClear={onConfirmClear}
        onCancelClear={onCancelClear}
      />
      <DemoOutcome saved={saved} cleared={cleared} failure={failure} messages={messages} />
    </section>
  );
}

/**
 * One demo dataset for the whole instance; a module contributes its own rows.
 * Clearing asks for confirmation first, and the card keeps the outcome on screen
 * instead of revalidating the page (a revalidation remounts it and the operator
 * would never see what happened).
 */
export function ModuleDemoCard({
  demo,
  messages,
}: {
  demo: DemoStatus;
  messages: TranslationMap;
}) {
  const [status, setStatus] = useState(demo);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<DemoActionState | null>(null);
  const [saved, setSaved] = useState<DemoActionState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState<number | null>(null);

  function run(action: () => Promise<DemoActionState>) {
    setFailure(null);
    setSaved(null);
    setConfirming(false);
    const membersBefore = status.members;
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setStatus(result.demo);
        setSaved(result);
        setCleared(result.demo.seeded ? null : membersBefore);
      } else {
        setFailure(result);
      }
    });
  }

  return (
    <DemoCardView
      demo={status}
      pending={pending}
      failure={failure}
      saved={saved}
      cleared={cleared}
      confirming={confirming}
      messages={messages}
      onSeed={() => run(seedDemoAction)}
      onAskClear={() => {
        setFailure(null);
        setSaved(null);
        setConfirming(true);
      }}
      onConfirmClear={() => run(clearDemoAction)}
      onCancelClear={() => setConfirming(false)}
    />
  );
}
