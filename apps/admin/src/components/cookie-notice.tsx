import { cookies } from "next/headers";
import Link from "next/link";
import { CookieNoticeDismiss } from "@/components/cookie-notice-dismiss";

const NOTICE_COOKIE = "027_cookie_notice";

/**
 * Informational cookie notice, rendered on the server from the cookie so it
 * never flashes. It sits in the page flow, so it never covers the content under
 * it; dismissing it removes the row. The session and the three preferences are
 * the only cookies this app writes.
 */
export async function CookieNotice({
  title,
  message,
  policyLabel,
  dismissLabel,
}: {
  title: string;
  message: string;
  policyLabel: string;
  dismissLabel: string;
}) {
  const store = await cookies();
  if (store.get(NOTICE_COOKIE)?.value === "1") return null;

  return (
    <div
      id="cookie-notice"
      role="region"
      aria-label={title}
      className="mb-3 flex w-full max-w-3xl flex-col gap-2 rounded-card border border-border bg-surface p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground">
        <strong className="text-foreground">{title}.</strong> {message}{" "}
        <Link href="/cookies" className="font-semibold text-accent hover:underline">
          {policyLabel}
        </Link>
      </p>
      <CookieNoticeDismiss label={dismissLabel} />
    </div>
  );
}
