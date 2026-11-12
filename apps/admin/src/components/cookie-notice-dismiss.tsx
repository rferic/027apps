"use client";

const NOTICE_COOKIE = "027_cookie_notice";

/** Writes the preference and removes the notice from the page. */
export function CookieNoticeDismiss({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${NOTICE_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=31536000`;
        document.getElementById("cookie-notice")?.remove();
      }}
      className="flex-none rounded-control border border-border px-3 py-1.5 font-semibold text-foreground"
    >
      {label}
    </button>
  );
}
