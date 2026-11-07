import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { memberErrorCodeLabel } from "@/lib/member-errors";
import type { MemberFailure } from "@/lib/panel-members";

interface MemberErrorProps {
  error: MemberFailure;
  heading: string;
  retryHref: string;
  messages: TranslationMap;
}

/** Inline load failure: translated code, copyable request id and a retry link. */
export function MemberError({ error, heading, retryHref, messages }: MemberErrorProps) {
  return (
    <div role="alert" className="rounded-card border border-destructive bg-surface p-4 text-xs">
      <h2 className="text-sm font-semibold text-destructive">{heading}</h2>
      {error.code && (
        <p className="mt-2 text-muted-foreground">{memberErrorCodeLabel(error.code, messages)}</p>
      )}
      {error.requestId && (
        <p className="mt-2 text-muted-foreground">
          {t("Request ID", messages)}:{" "}
          <code className="select-all font-mono">{error.requestId}</code>
        </p>
      )}
      <Link
        href={retryHref}
        className="mt-2 inline-block font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Try again", messages)}
      </Link>
    </div>
  );
}
