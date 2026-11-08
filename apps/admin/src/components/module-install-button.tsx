"use client";

import { useRef, useState, useTransition } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { installModuleAction } from "@/app/(panel)/modules/install/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form";
import type { InstallFailureReason } from "@/lib/module-install";

/** Every failure the action can return, as a message the user can act on. */
function reasonLabel(reason: InstallFailureReason, messages: TranslationMap): string {
  switch (reason) {
    case "already_installed":
      return t("This module is already installed.", messages);
    case "invalid_manifest":
      return t("The module package is not valid.", messages);
    case "forbidden":
      return t("You do not have permission to do that.", messages);
    default:
      return t("Something went wrong on the server.", messages);
  }
}

export interface InstallFailure {
  reason: InstallFailureReason;
  message: string;
  requestId?: string;
}

/** What the action returns: nothing means the install redirected to the module. */
type InstallOutcome =
  | { ok: false; reason: InstallFailureReason; requestId?: string }
  | undefined
  | void;

/**
 * One install at a time. The guard is read before React re-renders the
 * disabled button, so a second click in the same tick is dropped; the Core's
 * 409 remains the safety net if two requests still race.
 */
export async function installOnce(
  gate: { current: boolean },
  request: () => Promise<InstallOutcome>,
  onFailure: (failure: InstallFailure) => void,
  messages: TranslationMap,
): Promise<void> {
  if (gate.current) return;
  gate.current = true;
  try {
    const result = await request();
    // A successful install redirects; only a returned state is a failure.
    if (!result) return;
    onFailure({
      reason: result.reason,
      message: reasonLabel(result.reason, messages),
      ...(result.requestId ? { requestId: result.requestId } : {}),
    });
  } finally {
    gate.current = false;
  }
}

/** Presentational half: the markup of both states, testable without a DOM. */
export function InstallButtonView({
  pending,
  failure,
  messages,
  onInstall,
}: {
  pending: boolean;
  failure: InstallFailure | null;
  messages: TranslationMap;
  onInstall: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" className="min-h-11" onClick={onInstall} disabled={pending}>
        {pending ? t("Installing…", messages) : t("Install", messages)}
      </Button>
      {failure && (
        <FormAlert
          message={t("We couldn't install the module.", messages)}
          code={failure.reason}
          codeLabel={failure.message}
          requestId={failure.requestId}
          messages={messages}
        />
      )}
    </div>
  );
}

/**
 * Install button for one trusted package. The server action gates the role,
 * calls the Core route in process and redirects on success; only a failure
 * comes back here. The key never carries package content.
 */
export function ModuleInstallButton({
  moduleKey,
  messages,
}: {
  moduleKey: string;
  messages: TranslationMap;
}) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<InstallFailure | null>(null);
  const gate = useRef(false);

  function handleInstall() {
    // Reject the click before the transition, so it does not clear the alert either.
    if (gate.current) return;
    setFailure(null);
    startTransition(async () => {
      await installOnce(gate, () => installModuleAction(moduleKey), setFailure, messages);
    });
  }

  return (
    <InstallButtonView
      pending={pending}
      failure={failure}
      messages={messages}
      onInstall={handleInstall}
    />
  );
}
