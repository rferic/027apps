"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { setModuleDelegable } from "@/lib/module-mutations";
import type { MutationFailure } from "@/lib/mutation-result";

/**
 * Whether a private module is inherited by the people a member invites (spec
 * §7.7). Public modules are always inherited, so the switch only appears for
 * private ones; for a public module it just states the rule.
 */
export function ModuleDelegable({
  moduleKey,
  isPublic,
  delegable,
  messages,
}: {
  moduleKey: string;
  isPublic: boolean;
  delegable: boolean;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [value, setValue] = useState(delegable);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const id = "module-delegable";

  async function toggle(next: boolean) {
    setPending(true);
    setFailure(null);
    const result = await setModuleDelegable(moduleKey, next);
    setPending(false);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    setValue(next);
    router.refresh();
  }

  return (
    <section
      aria-labelledby="module-delegable-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-delegable-title" className="text-sm font-semibold">
        {t("Member invitations", messages)}
      </h2>
      {isPublic ? (
        <p className="text-xs text-muted-foreground">
          {t("A public module is always inherited by invitees.", messages)}
        </p>
      ) : (
        <>
          <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              id={id}
              type="checkbox"
              checked={value}
              disabled={pending}
              onChange={(event) => void toggle(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="font-semibold">
              {t("Inherited by invitees (delegable)", messages)}
            </span>
            {pending && <span className="text-xs text-muted-foreground">{t("Saving…", messages)}</span>}
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              "When a member invites someone, the invitee inherits this private module only if it is delegable.",
              messages,
            )}
          </p>
        </>
      )}
      {failure && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {t("We couldn't save that change.", messages)}
        </p>
      )}
    </section>
  );
}
