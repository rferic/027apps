"use client";

import { useState, useTransition } from "react";
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

interface InstallFailure {
  reason: InstallFailureReason;
  message: string;
  requestId?: string;
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

  function handleInstall() {
    setFailure(null);
    startTransition(async () => {
      const result = await installModuleAction(moduleKey);
      // A successful install redirects; only a returned state is a failure.
      if (!result) return;
      setFailure({
        reason: result.reason,
        message: reasonLabel(result.reason, messages),
        ...(result.requestId ? { requestId: result.requestId } : {}),
      });
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" className="min-h-11" onClick={handleInstall} disabled={pending}>
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
