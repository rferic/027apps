"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { setModulePublic } from "@/lib/module-mutations";
import type { MutationFailure } from "@/lib/mutation-result";

/**
 * Who can use the module. A public module is in every active user's app —list,
 * widgets and API scopes— without a single grant; a private one needs a member
 * or category grant. The switch writes straight away and refreshes the page, so
 * the grants section below shows the same truth the app will see.
 */
export function ModuleAccess({
  moduleKey,
  isPublic,
  messages,
}: {
  moduleKey: string;
  isPublic: boolean;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [value, setValue] = useState(isPublic);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const id = "module-access-public";

  async function toggle(next: boolean) {
    setPending(true);
    setFailure(null);
    const result = await setModulePublic(moduleKey, next);
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
      aria-labelledby="module-access-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-access-title" className="text-sm font-semibold">
        {t("Who can use it", messages)}
      </h2>
      <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={value}
          disabled={pending}
          onChange={(event) => void toggle(event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        <span className="font-semibold">{t("Every user (public module)", messages)}</span>
        {pending && <span className="text-xs text-muted-foreground">{t("Saving…", messages)}</span>}
      </label>
      <p className="text-xs text-muted-foreground">
        {t(
          "A public module appears in every user's app, with its widgets and its API access, without individual grants. A private module needs a member or a category grant.",
          messages,
        )}
      </p>
      {failure && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {t("We couldn't save that change.", messages)}
        </p>
      )}
    </section>
  );
}
