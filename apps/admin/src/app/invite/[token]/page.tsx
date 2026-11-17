import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { t } from "@027apps/i18n/t.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { cancelClass } from "@/components/ui/form";
import { getInfra } from "@/lib/api/door";
import { latestAndroidRelease } from "@/lib/android-release";
import { APP_NAME } from "@/lib/brand";
import { isValidInviteToken } from "@/lib/invite-form";
import { loadInvitePreview } from "@/lib/invite-preview";
import { inviteVariant } from "@/lib/invite-variant";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelSettings, publicUrlFromSettings } from "@/lib/panel-settings";
import { InviteWizard } from "./invite-wizard";

export const instant = false;

export const metadata: Metadata = {
  title: APP_NAME,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const PAGE_LIMIT = 60;
/** GitHub can be slow; the version is a nicety, never a reason to block. */
const RELEASE_TIMEOUT_MS = 2_500;

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

function clientIp(value: string | null): string {
  return value?.split(",")[0]?.trim() || "unknown";
}

/** The public page has its own budget: rendering it is not rate limited by the API. */
async function overPageLimit(ip: string): Promise<boolean> {
  const { deps } = await getInfra();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / 60_000) * 60_000);
  const { count } = await deps.rateLimitStorage.increment(
    `invite-page:${ip}`,
    windowStart,
    new Date(windowStart.getTime() + 120_000),
  );
  return count > PAGE_LIMIT;
}

function requestOrigin(
  publicUrl: string | null,
  headerStore: { get(name: string): string | null },
): string {
  if (publicUrl) return publicUrl.replace(/\/+$/, "");
  const host = headerStore.get("host");
  if (!host) return "";
  const proto =
    headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function PageFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <BrandLogo size="md" />
        {children}
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}

function StateCard({
  title,
  body,
  messages,
}: {
  title: string;
  body: string;
  messages: TranslationMap;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-destructive">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link href="/login" className={cancelClass}>
        {t("Sign in", messages)}
      </Link>
    </section>
  );
}

function closedInvitationCopy(
  state: "used" | "expired",
  messages: TranslationMap,
): { title: string; body: string } {
  return state === "used"
    ? {
        title: t("This invitation has already been used.", messages),
        body: t("Sign in if you already accepted it.", messages),
      }
    : {
        title: t("This invitation has expired. Ask an administrator for a new one.", messages),
        body: t("The invitation link is no longer valid.", messages),
      };
}

async function wizardChrome(
  variant: ReturnType<typeof inviteVariant>,
  token: string,
  origin: string,
): Promise<{ releaseVersion: string | null; qrSvg: string | null }> {
  const release =
    variant === "android"
      ? await Promise.race([
          latestAndroidRelease().catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), RELEASE_TIMEOUT_MS)),
        ])
      : null;
  // Locally generated SVG: no QR service, no `data:` URL and no new CSP entry.
  const qrSvg =
    variant === "desktop" && origin
      ? await QRCode.toString(`${origin}/invite/${encodeURIComponent(token)}`, {
          type: "svg",
          margin: 2,
          width: 176,
          // A QR must stay pure black on white in both themes: a palette token
          // would make it unscannable, and the library only accepts hex.
          // eslint-disable-next-line no-restricted-syntax
          color: { dark: "#000000", light: "#ffffff" },
        })
      : null;
  return { releaseVersion: release?.versionName ?? null, qrSvg };
}

/**
 * Public redemption page. No session and no Supabase: the preview resolves the
 * invitation, the locale comes from the invitation itself and the token stays
 * in the URL only until the form replaces the history entry.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  await connection();
  const [{ token }, cookieStore, headerStore] = await Promise.all([params, cookies(), headers()]);
  const cookieLocale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });

  if (!isValidInviteToken(token)) {
    const messages = getDictionary(cookieLocale);
    return (
      <PageFrame locale={cookieLocale}>
        <StateCard
          title={t("This invitation link is not valid.", messages)}
          body={t("Ask an administrator for a new invitation.", messages)}
          messages={messages}
        />
      </PageFrame>
    );
  }

  if (await overPageLimit(clientIp(headerStore.get("x-forwarded-for")))) {
    const messages = getDictionary(cookieLocale);
    return (
      <PageFrame locale={cookieLocale}>
        <StateCard
          title={t("Too many attempts. Wait a minute and try again.", messages)}
          body={t("Reload this page in a moment.", messages)}
          messages={messages}
        />
      </PageFrame>
    );
  }

  const preview = await loadInvitePreview(token);
  const locale = preview?.locale ?? cookieLocale;
  const messages = getDictionary(locale);

  if (!preview) {
    return (
      <PageFrame locale={locale}>
        <StateCard
          title={t("This invitation link is not valid.", messages)}
          body={t("Ask an administrator for a new invitation.", messages)}
          messages={messages}
        />
      </PageFrame>
    );
  }

  if (preview.state !== "pending") {
    const copy = closedInvitationCopy(preview.state, messages);
    return (
      <PageFrame locale={locale}>
        <StateCard title={copy.title} body={copy.body} messages={messages} />
      </PageFrame>
    );
  }

  const variant = inviteVariant(headerStore.get("user-agent"));
  const settings = await loadPanelSettings();
  const origin = requestOrigin(publicUrlFromSettings(settings), headerStore);
  const { releaseVersion, qrSvg } = await wizardChrome(variant, token, origin);

  return (
    <main lang={locale} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <BrandLogo size="md" />
        <InviteWizard
          token={token}
          view={{
            email: preview.email,
            name: preview.name,
            role: preview.role,
            role_applies: preview.role_applies,
            account_exists: preview.account_exists,
            inviter_name: preview.inviter_name,
            instance_name: preview.instance_name,
            expires_at: preview.expires_at,
            timezone: preview.timezone,
            locale,
          }}
          variant={variant}
          origin={origin}
          releaseVersion={releaseVersion}
          qrSvg={qrSvg}
          messages={messages}
        />
      </div>
      <DocumentLang locale={locale} />
    </main>
  );
}
