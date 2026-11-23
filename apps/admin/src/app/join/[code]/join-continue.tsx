"use client";

import { useState } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";

/**
 * The single "Continue" action on `/join/[code]`. The GET only previews; this
 * button does the exchange and navigates with `window.location.assign` (not
 * `router.push`), so the `/invite/<token>` App Link can open the installed app.
 */
export function JoinContinue({
  code,
  messages,
}: {
  code: string;
  messages: TranslationMap;
}) {
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exchange() {
    setExchanging(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/join-codes/${encodeURIComponent(code)}/exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        const body = (await res.json()) as { path: string };
        window.location.assign(body.path);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      setError(errorCopy(body?.error?.code, messages));
    } catch {
      setError(t("The link is not valid or has expired. Request a new one.", messages));
    } finally {
      setExchanging(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        className="min-h-11"
        disabled={exchanging}
        onClick={exchange}
      >
        {t("Continue", messages)}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function errorCopy(code: string | undefined, messages: TranslationMap): string {
  if (code === "join_code_used") return t("This invitation has already been used.", messages);
  // A quota race (the seat was taken while the page was open) has its own card:
  // the club is full and the invitee asks the administrator (spec §7.1).
  if (code === "invitation_quota_exhausted") {
    return t("No seats left. Ask the administrator for more.", messages);
  }
  return t("The link is not valid or has expired. Request a new one.", messages);
}
