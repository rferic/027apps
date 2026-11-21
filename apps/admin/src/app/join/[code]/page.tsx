import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDictionary } from "@027apps/i18n/dictionary.js";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { BrandLogo } from "@/components/brand-logo";
import { DocumentLang } from "@/components/document-lang";
import { getInfra } from "@/lib/api/door";
import { clientIp } from "@/lib/client-ip";
import { loadJoinPreview } from "@/lib/join-preview";
import { requestLocale } from "@/lib/request-locale";
import { JoinContinue } from "./join-continue";

export const instant = false;

export const metadata: Metadata = {
  title: "027Apps",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const PAGE_LIMIT = 60;

/**
 * Rendering this page queries Postgres, so it has its own per-IP budget: the
 * API endpoint's limit does not cover the SSR path.
 */
async function overPageLimit(ip: string): Promise<boolean> {
  const { deps } = await getInfra();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / 60_000) * 60_000);
  const { count } = await deps.rateLimitStorage.increment(
    `join-page:${ip}`,
    windowStart,
    new Date(windowStart.getTime() + 120_000),
  );
  return count > PAGE_LIMIT;
}

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

function Frame({ locale, children }: { locale: Locale; children: React.ReactNode }) {
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function StateCard({ title, messages }: { title: string; messages: TranslationMap }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-destructive">{title}</p>
      <p className="text-sm text-muted-foreground">
        {t("The link is not valid or has expired. Request a new one.", messages)}
      </p>
    </section>
  );
}

/**
 * Public landing of a rotating QR (`/join/<code>`). The GET never exchanges:
 * it only previews the code and paints the inviter, the instance and the state,
 * so a WhatsApp prefetch cannot consume the code. The button performs the
 * single-use exchange.
 */
export default async function JoinPage({ params }: JoinPageProps) {
  const [{ code }, locale, headerStore] = await Promise.all([
    params,
    requestLocale(),
    headers(),
  ]);
  const messages = getDictionary(locale);

  if (await overPageLimit(clientIp(headerStore))) {
    return (
      <Frame locale={locale}>
        <StateCard
          title={t("Too many attempts. Wait a minute and try again.", messages)}
          messages={messages}
        />
      </Frame>
    );
  }

  const preview = await loadJoinPreview(code);

  if (!preview) {
    return (
      <Frame locale={locale}>
        <StateCard
          title={t("The link is not valid or has expired. Request a new one.", messages)}
          messages={messages}
        />
      </Frame>
    );
  }

  if (preview.state === "used") {
    return (
      <Frame locale={locale}>
        <StateCard title={t("This invitation has already been used.", messages)} messages={messages} />
      </Frame>
    );
  }

  if (preview.state === "expired") {
    return (
      <Frame locale={locale}>
        <StateCard
          title={t("This invitation has expired. Ask an administrator for a new one.", messages)}
          messages={messages}
        />
      </Frame>
    );
  }

  return (
    <Frame locale={locale}>
      <div>
        <h1 className="text-2xl font-semibold">
          {t("You have been invited to join", messages)} <strong>{preview.instance_name}</strong>.
        </h1>
      </div>
      <dl className="grid grid-cols-1 gap-3 rounded-card border border-border bg-muted/40 p-4">
        <Row label={t("Invited by", messages)}>
          {preview.inviter_name ?? preview.instance_name}
        </Row>
        <Row label={t("Instance", messages)}>{preview.instance_name}</Row>
      </dl>
      <JoinContinue code={code} messages={messages} />
    </Frame>
  );
}
